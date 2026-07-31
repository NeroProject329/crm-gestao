import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PaymentReceiptStatus,
} from '@crm/database';

import type {
  AdminReceiptActionResponse,
  AdminReceiptView,
  EmployeeReceiptView,
  ReceiptFileUrlResponse,
} from '@crm/contracts';

import type {
  AuthContext,
} from '../auth/auth-context';

import {
  businessDateInTimezone,
  formatBusinessDate,
  parseBusinessDate,
} from '../common/business-date';

import {
  DatabaseService,
} from '../database/database.service';


import {
  ReceiptStorageService,
} from '../uploads/receipt-storage.service';

import type {
  ApproveReceiptDto,
} from './dto/approve-receipt.dto';

import type {
  ListAdminReceiptsQueryDto,
} from './dto/list-admin-receipts-query.dto';

import type {
  ListMyReceiptsQueryDto,
} from './dto/list-my-receipts-query.dto';

import type {
  RejectReceiptDto,
} from './dto/reject-receipt.dto';

import type {
  ReverseReceiptDto,
} from './dto/reverse-receipt.dto';

import type {
  SubmitReceiptDto,
} from './dto/submit-receipt.dto';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly storage:
      ReceiptStorageService,
  ) {}

  async submit(
    auth: AuthContext,
    employeeId: string,
    dto: SubmitReceiptDto,
  ): Promise<EmployeeReceiptView> {
    const upload =
      await this.storage
        .validateCompletedUpload(
          dto.uploadToken,
        );

    if (
      upload.companyId !==
        auth.companyId ||
      upload.employeeId !==
        employeeId
    ) {
      throw new BadRequestException(
        'Upload does not belong to the authenticated employee.',
      );
    }

    const alreadyUsed =
      await this.database.prisma
        .receiptFile.findUnique({
          where: {
            objectKey:
              upload.objectKey,
          },

          select: {
            id: true,
          },
        });

    if (alreadyUsed) {
      throw new ConflictException(
        'This upload has already been used.',
      );
    }

    const paidAt =
      new Date(dto.paidAt);

    if (
      Number.isNaN(
        paidAt.getTime(),
      )
    ) {
      throw new BadRequestException(
        'paidAt is invalid.',
      );
    }

    if (
      paidAt.getTime() >
      Date.now() + 5 * 60_000
    ) {
      throw new BadRequestException(
        'paidAt cannot be in the future.',
      );
    }

    const settings =
      await this.database.prisma
        .companySettings.findUnique({
          where: {
            companyId:
              auth.companyId,
          },
        });

    if (!settings) {
      throw new BadRequestException(
        'Company settings were not found.',
      );
    }

    const businessDateString =
      businessDateInTimezone(
        paidAt,
        settings.timezone,
      );

    const businessDate =
      parseBusinessDate(
        businessDateString,
      );

    const receipt =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const created =
              await tx
                .paymentReceipt.create({
                  data: {
                    companyId:
                      auth.companyId,

                    employeeId,

                    amount:
                      dto.amount,

                    payerName:
                      dto.payerName.trim(),

                    paidAt,

                    businessDate,

                    status:
                      PaymentReceiptStatus.PENDING,

                    file: {
                      create: {
                        provider:
                          'r2',

                        objectKey:
                          upload.objectKey,

                        mimeType:
                          upload.mimeType,

                        sizeBytes:
                          BigInt(
                            upload.sizeBytes,
                          ),
                      },
                    },
                  },

                  include: {
                    file: true,
                  },
                });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'receipt.submitted',

                entityType:
                  'PaymentReceipt',

                entityId:
                  created.id,

                after: {
                  employeeId,

                  amount:
                    created.amount
                      .toFixed(2),

                  payerName:
                    created.payerName,

                  paidAt:
                    created.paidAt
                      .toISOString(),

                  businessDate:
                    businessDateString,

                  status:
                    created.status,

                  mimeType:
                    upload.mimeType,

                  sizeBytes:
                    upload.sizeBytes,
                },
              },
            });

            await tx.outboxEvent.create({
              data: {
                companyId:
                  auth.companyId,

                eventType:
                  'receipt.submitted',

                aggregateType:
                  'PaymentReceipt',

                aggregateId:
                  created.id,

                payload: {
                  receiptId:
                    created.id,

                  employeeId,

                  businessDate:
                    businessDateString,
                },
              },
            });

            return created;
          },
        );

    return this.toEmployeeView(
      receipt,
    );
  }

  async listMy(
    companyId: string,
    employeeId: string,
    query: ListMyReceiptsQueryDto,
  ): Promise<EmployeeReceiptView[]> {
    const receipts =
      await this.database.prisma
        .paymentReceipt.findMany({
          where: {
            companyId,
            employeeId,

            ...(query.status
              ? {
                  status:
                    query.status as
                      PaymentReceiptStatus,
                }
              : {}),

            ...(query.from || query.to
              ? {
                  businessDate: {
                    ...(query.from
                      ? {
                          gte:
                            parseBusinessDate(
                              query.from,
                              'from',
                            ),
                        }
                      : {}),

                    ...(query.to
                      ? {
                          lte:
                            parseBusinessDate(
                              query.to,
                              'to',
                            ),
                        }
                      : {}),
                  },
                }
              : {}),
          },

          include: {
            file: true,
          },

          orderBy: [
            {
              businessDate:
                'desc',
            },
            {
              createdAt:
                'desc',
            },
          ],

          take:
            100,
        });

    return receipts.map(
      (receipt) =>
        this.toEmployeeView(
          receipt,
        ),
    );
  }

  async listAdmin(
    companyId: string,
    query: ListAdminReceiptsQueryDto,
  ): Promise<AdminReceiptView[]> {
    const receipts =
      await this.database.prisma
        .paymentReceipt.findMany({
          where: {
            companyId,

            ...(query.employeeId
              ? {
                  employeeId:
                    query.employeeId,
                }
              : {}),

            ...(query.status
              ? {
                  status:
                    query.status as
                      PaymentReceiptStatus,
                }
              : {}),

            ...(query.from || query.to
              ? {
                  businessDate: {
                    ...(query.from
                      ? {
                          gte:
                            parseBusinessDate(
                              query.from,
                              'from',
                            ),
                        }
                      : {}),

                    ...(query.to
                      ? {
                          lte:
                            parseBusinessDate(
                              query.to,
                              'to',
                            ),
                        }
                      : {}),
                  },
                }
              : {}),
          },

          include: {
            file: true,
          },

          orderBy: [
            {
              businessDate:
                'desc',
            },
            {
              createdAt:
                'desc',
            },
          ],

          take:
            100,
        });

    return receipts.map(
      (receipt) =>
        this.toAdminView(
          receipt,
        ),
    );
  }

  async cancelMy(
    auth: AuthContext,
    employeeId: string,
    receiptId: string,
  ): Promise<EmployeeReceiptView> {
    const existing =
      await this.findMyReceipt(
        auth.companyId,
        employeeId,
        receiptId,
      );

    if (
      existing.status ===
      PaymentReceiptStatus.CANCELED
    ) {
      return this.toEmployeeView(
        existing,
      );
    }

    if (
      existing.status !==
      PaymentReceiptStatus.PENDING
    ) {
      throw new ConflictException(
        'Only a pending receipt can be canceled.',
      );
    }

    const receipt =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const changed =
              await tx.paymentReceipt
                .updateMany({
                  where: {
                    id:
                      receiptId,

                    companyId:
                      auth.companyId,

                    employeeId,

                    status:
                      PaymentReceiptStatus.PENDING,
                  },

                  data: {
                    status:
                      PaymentReceiptStatus.CANCELED,
                  },
                });

            if (
              changed.count !== 1
            ) {
              throw new ConflictException(
                'Receipt status changed before cancellation.',
              );
            }

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'receipt.canceled',

                entityType:
                  'PaymentReceipt',

                entityId:
                  receiptId,

                before: {
                  status:
                    PaymentReceiptStatus.PENDING,
                },

                after: {
                  status:
                    PaymentReceiptStatus.CANCELED,
                },
              },
            });

            await tx.outboxEvent.create({
              data: {
                companyId:
                  auth.companyId,

                eventType:
                  'receipt.canceled',

                aggregateType:
                  'PaymentReceipt',

                aggregateId:
                  receiptId,

                payload: {
                  receiptId,
                  employeeId,
                },
              },
            });

            return tx.paymentReceipt
              .findUniqueOrThrow({
                where: {
                  id:
                    receiptId,
                },

                include: {
                  file: true,
                },
              });
          },
        );

    return this.toEmployeeView(
      receipt,
    );
  }

  async approve(
    auth: AuthContext,
    receiptId: string,
    dto: ApproveReceiptDto,
  ): Promise<AdminReceiptActionResponse> {
    const existing =
      await this.findAdminReceipt(
        auth.companyId,
        receiptId,
      );

    if (
      existing.status ===
      PaymentReceiptStatus.APPROVED
    ) {
      return {
        receipt:
          this.toAdminView(
            existing,
          ),

        recalculation:
          null,
      };
    }

    if (
      existing.status !==
      PaymentReceiptStatus.PENDING
    ) {
      throw new ConflictException(
        'Only a pending receipt can be approved.',
      );
    }

    const reviewedAt =
      new Date();

    const updated =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const changed =
              await tx.paymentReceipt
                .updateMany({
                  where: {
                    id:
                      receiptId,

                    companyId:
                      auth.companyId,

                    status:
                      PaymentReceiptStatus.PENDING,
                  },

                  data: {
                    status:
                      PaymentReceiptStatus.APPROVED,

                    reviewedByUserId:
                      auth.userId,

                    reviewedAt,

                    reviewNote:
                      dto.note?.trim() ??
                      null,
                  },
                });

            if (
              changed.count !== 1
            ) {
              throw new ConflictException(
                'Receipt status changed before approval.',
              );
            }

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'receipt.approved',

                entityType:
                  'PaymentReceipt',

                entityId:
                  receiptId,

                before: {
                  status:
                    PaymentReceiptStatus.PENDING,
                },

                after: {
                  status:
                    PaymentReceiptStatus.APPROVED,

                  reviewedAt:
                    reviewedAt
                      .toISOString(),
                },
              },
            });

            await tx.outboxEvent.create({
              data: {
                companyId:
                  auth.companyId,

                eventType:
                  'receipt.approved',

                aggregateType:
                  'PaymentReceipt',

                aggregateId:
                  receiptId,

                payload: {
                  receiptId,

                  employeeId:
                    existing.employeeId,

                  effectiveFrom:
                    formatBusinessDate(
                      existing.businessDate,
                    ),
                },
              },
            });

            return tx.paymentReceipt
              .findUniqueOrThrow({
                where: {
                  id:
                    receiptId,
                },

                include: {
                  file: true,
                },
              });
          },
        );

    const effectiveFrom =
      formatBusinessDate(
        updated.businessDate,
      );


    return {
      receipt:
        this.toAdminView(
          updated,
        ),

      recalculation: {
        status:
          'PENDING',

        effectiveFrom,
      },
    };
  }

  async reject(
    auth: AuthContext,
    receiptId: string,
    dto: RejectReceiptDto,
  ): Promise<AdminReceiptActionResponse> {
    const existing =
      await this.findAdminReceipt(
        auth.companyId,
        receiptId,
      );

    if (
      existing.status ===
      PaymentReceiptStatus.REJECTED
    ) {
      return {
        receipt:
          this.toAdminView(
            existing,
          ),

        recalculation:
          null,
      };
    }

    if (
      existing.status !==
      PaymentReceiptStatus.PENDING
    ) {
      throw new ConflictException(
        'Only a pending receipt can be rejected.',
      );
    }

    const reviewedAt =
      new Date();

    const updated =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const changed =
              await tx.paymentReceipt
                .updateMany({
                  where: {
                    id:
                      receiptId,

                    companyId:
                      auth.companyId,

                    status:
                      PaymentReceiptStatus.PENDING,
                  },

                  data: {
                    status:
                      PaymentReceiptStatus.REJECTED,

                    reviewedByUserId:
                      auth.userId,

                    reviewedAt,

                    reviewNote:
                      dto.reason.trim(),
                  },
                });

            if (
              changed.count !== 1
            ) {
              throw new ConflictException(
                'Receipt status changed before rejection.',
              );
            }

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'receipt.rejected',

                entityType:
                  'PaymentReceipt',

                entityId:
                  receiptId,

                before: {
                  status:
                    PaymentReceiptStatus.PENDING,
                },

                after: {
                  status:
                    PaymentReceiptStatus.REJECTED,

                  reason:
                    dto.reason.trim(),
                },
              },
            });

            await tx.outboxEvent.create({
              data: {
                companyId:
                  auth.companyId,

                eventType:
                  'receipt.rejected',

                aggregateType:
                  'PaymentReceipt',

                aggregateId:
                  receiptId,

                payload: {
                  receiptId,

                  employeeId:
                    existing.employeeId,
                },
              },
            });

            return tx.paymentReceipt
              .findUniqueOrThrow({
                where: {
                  id:
                    receiptId,
                },

                include: {
                  file: true,
                },
              });
          },
        );

    return {
      receipt:
        this.toAdminView(
          updated,
        ),

      recalculation:
        null,
    };
  }

  async reverse(
    auth: AuthContext,
    receiptId: string,
    dto: ReverseReceiptDto,
  ): Promise<AdminReceiptActionResponse> {
    const existing =
      await this.findAdminReceipt(
        auth.companyId,
        receiptId,
      );

    if (
      existing.status ===
      PaymentReceiptStatus.REVERSED
    ) {
      return {
        receipt:
          this.toAdminView(
            existing,
          ),

        recalculation:
          null,
      };
    }

    if (
      existing.status !==
      PaymentReceiptStatus.APPROVED
    ) {
      throw new ConflictException(
        'Only an approved receipt can be reversed.',
      );
    }

    const reversedAt =
      new Date();

    const updated =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const changed =
              await tx.paymentReceipt
                .updateMany({
                  where: {
                    id:
                      receiptId,

                    companyId:
                      auth.companyId,

                    status:
                      PaymentReceiptStatus.APPROVED,
                  },

                  data: {
                    status:
                      PaymentReceiptStatus.REVERSED,

                    reversedByUserId:
                      auth.userId,

                    reversedAt,

                    reversalReason:
                      dto.reason.trim(),
                  },
                });

            if (
              changed.count !== 1
            ) {
              throw new ConflictException(
                'Receipt status changed before reversal.',
              );
            }

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'receipt.reversed',

                entityType:
                  'PaymentReceipt',

                entityId:
                  receiptId,

                before: {
                  status:
                    PaymentReceiptStatus.APPROVED,
                },

                after: {
                  status:
                    PaymentReceiptStatus.REVERSED,

                  reason:
                    dto.reason.trim(),

                  reversedAt:
                    reversedAt
                      .toISOString(),
                },
              },
            });

            await tx.outboxEvent.create({
              data: {
                companyId:
                  auth.companyId,

                eventType:
                  'receipt.reversed',

                aggregateType:
                  'PaymentReceipt',

                aggregateId:
                  receiptId,

                payload: {
                  receiptId,

                  employeeId:
                    existing.employeeId,

                  effectiveFrom:
                    formatBusinessDate(
                      existing.businessDate,
                    ),
                },
              },
            });

            return tx.paymentReceipt
              .findUniqueOrThrow({
                where: {
                  id:
                    receiptId,
                },

                include: {
                  file: true,
                },
              });
          },
        );

    const effectiveFrom =
      formatBusinessDate(
        updated.businessDate,
      );


    return {
      receipt:
        this.toAdminView(
          updated,
        ),

      recalculation: {
        status:
          'PENDING',

        effectiveFrom,
      },
    };
  }

  async getMyFileUrl(
    companyId: string,
    employeeId: string,
    receiptId: string,
  ): Promise<ReceiptFileUrlResponse> {
    const receipt =
      await this.findMyReceipt(
        companyId,
        employeeId,
        receiptId,
      );

    if (!receipt.file) {
      throw new NotFoundException(
        'Receipt file not found.',
      );
    }

    return this.storage
      .createDownloadUrl(
        receipt.file.objectKey,
      );
  }

  async getAdminFileUrl(
    companyId: string,
    receiptId: string,
  ): Promise<ReceiptFileUrlResponse> {
    const receipt =
      await this.findAdminReceipt(
        companyId,
        receiptId,
      );

    if (!receipt.file) {
      throw new NotFoundException(
        'Receipt file not found.',
      );
    }

    return this.storage
      .createDownloadUrl(
        receipt.file.objectKey,
      );
  }

  private async findMyReceipt(
    companyId: string,
    employeeId: string,
    receiptId: string,
  ) {
    const receipt =
      await this.database.prisma
        .paymentReceipt.findFirst({
          where: {
            id:
              receiptId,

            companyId,
            employeeId,
          },

          include: {
            file: true,
          },
        });

    if (!receipt) {
      throw new NotFoundException(
        'Receipt not found.',
      );
    }

    return receipt;
  }

  private async findAdminReceipt(
    companyId: string,
    receiptId: string,
  ) {
    const receipt =
      await this.database.prisma
        .paymentReceipt.findFirst({
          where: {
            id:
              receiptId,

            companyId,
          },

          include: {
            file: true,
          },
        });

    if (!receipt) {
      throw new NotFoundException(
        'Receipt not found.',
      );
    }

    return receipt;
  }

  private toEmployeeView(
    receipt: {
      id: string;

      amount: {
        toFixed(
          decimalPlaces: number,
        ): string;
      };

      payerName: string;

      paidAt: Date;
      businessDate: Date;

      status:
        PaymentReceiptStatus;

      createdAt: Date;
      updatedAt: Date;

      file:
        | {
            mimeType: string;
            sizeBytes: bigint;
          }
        | null;
    },
  ): EmployeeReceiptView {
    if (!receipt.file) {
      throw new Error(
        'Receipt file metadata is missing.',
      );
    }

    return {
      id:
        receipt.id,

      amount:
        receipt.amount
          .toFixed(2),

      payerName:
        receipt.payerName,

      paidAt:
        receipt.paidAt
          .toISOString(),

      businessDate:
        formatBusinessDate(
          receipt.businessDate,
        ),

      status:
        receipt.status,

      file: {
        mimeType:
          receipt.file.mimeType,

        sizeBytes:
          Number(
            receipt.file.sizeBytes,
          ),
      },

      createdAt:
        receipt.createdAt
          .toISOString(),

      updatedAt:
        receipt.updatedAt
          .toISOString(),
    };
  }

  private toAdminView(
    receipt: {
      id: string;

      companyId: string;
      employeeId: string;

      amount: {
        toFixed(
          decimalPlaces: number,
        ): string;
      };

      payerName: string;

      paidAt: Date;
      businessDate: Date;

      status:
        PaymentReceiptStatus;

      reviewedByUserId:
        | string
        | null;

      reviewedAt:
        | Date
        | null;

      reviewNote:
        | string
        | null;

      reversedByUserId:
        | string
        | null;

      reversedAt:
        | Date
        | null;

      reversalReason:
        | string
        | null;

      createdAt: Date;
      updatedAt: Date;

      file:
        | {
            mimeType: string;
            sizeBytes: bigint;
          }
        | null;
    },
  ): AdminReceiptView {
    const employeeView =
      this.toEmployeeView(
        receipt,
      );

    return {
      ...employeeView,

      companyId:
        receipt.companyId,

      employeeId:
        receipt.employeeId,

      reviewedByUserId:
        receipt.reviewedByUserId,

      reviewedAt:
        receipt.reviewedAt
          ?.toISOString() ??
        null,

      reviewNote:
        receipt.reviewNote,

      reversedByUserId:
        receipt.reversedByUserId,

      reversedAt:
        receipt.reversedAt
          ?.toISOString() ??
        null,

      reversalReason:
        receipt.reversalReason,
    };
  }
}