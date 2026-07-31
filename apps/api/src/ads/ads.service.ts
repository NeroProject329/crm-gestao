import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AdsEntryStatus,
  UserRole,
} from '@crm/database';

import type {
  AdsEntryView,
  AdsMutationResponse,
} from '@crm/contracts';

import {
  DatabaseService,
} from '../database/database.service';

import type {
  AuthContext,
} from '../auth/auth-context';

import {
  formatBusinessDate,
  parseBusinessDate,
} from '../common/business-date';

import {
  FinancialRecalculationService,
} from '../financial-engine/financial-recalculation.service';

import type {
  CreateAdsEntryDto,
} from './dto/create-ads-entry.dto';

import type {
  UpdateAdsEntryDto,
} from './dto/update-ads-entry.dto';

import type {
  ListAdsQueryDto,
} from './dto/list-ads-query.dto';

@Injectable()
export class AdsService {
  constructor(
    private readonly database:
      DatabaseService,

    private readonly recalculation:
      FinancialRecalculationService,
  ) {}

  async list(
    companyId: string,
    query: ListAdsQueryDto,
  ): Promise<AdsEntryView[]> {
    const from =
      query.from
        ? parseBusinessDate(
            query.from,
            'from',
          )
        : undefined;

    const to =
      query.to
        ? parseBusinessDate(
            query.to,
            'to',
          )
        : undefined;

    const entries =
      await this.database.prisma
        .adsEntry.findMany({
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
                    query.status,
                }
              : {}),

            ...(from || to
              ? {
                  businessDate: {
                    ...(from
                      ? {
                          gte: from,
                        }
                      : {}),

                    ...(to
                      ? {
                          lte: to,
                        }
                      : {}),
                  },
                }
              : {}),
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
        });

    return entries.map(
      (entry) =>
        this.toView(entry),
    );
  }

  async get(
    companyId: string,
    adsEntryId: string,
  ): Promise<AdsEntryView> {
    const entry =
      await this.findEntry(
        companyId,
        adsEntryId,
      );

    return this.toView(
      entry,
    );
  }

  async create(
    auth: AuthContext,
    dto: CreateAdsEntryDto,
  ): Promise<AdsMutationResponse> {
    await this.assertEmployee(
      auth.companyId,
      dto.employeeId,
    );

    const businessDate =
      parseBusinessDate(
        dto.businessDate,
      );

    const entry =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const created =
              await tx.adsEntry.create({
                data: {
                  companyId:
                    auth.companyId,

                  employeeId:
                    dto.employeeId,

                  businessDate,

                  amount:
                    dto.amount,

                  status:
                    AdsEntryStatus.ACTIVE,
                },
              });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'ads.created',

                entityType:
                  'AdsEntry',

                entityId:
                  created.id,

                after: {
                  employeeId:
                    created.employeeId,

                  businessDate:
                    dto.businessDate,

                  amount:
                    created.amount
                      .toFixed(2),

                  status:
                    created.status,
                },
              },
            });

            await tx.outboxEvent
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  eventType:
                    'ads.changed',

                  aggregateType:
                    'AdsEntry',

                  aggregateId:
                    created.id,

                  payload: {
                    operation:
                      'CREATED',

                    employeeId:
                      created.employeeId,

                    effectiveFrom:
                      dto.businessDate,
                  },
                },
              });

            return created;
          },
        );

    const recalculated =
      await this.recalculation
        .tryRecalculateEmployeeFrom(
          entry.employeeId,
          dto.businessDate,
        );

    return {
      adsEntry:
        this.toView(entry),

      recalculation: {
        status:
          recalculated
            ? 'COMPLETED'
            : 'PENDING',

        effectiveFrom:
          dto.businessDate,
      },
    };
  }

  async update(
    auth: AuthContext,
    adsEntryId: string,
    dto: UpdateAdsEntryDto,
  ): Promise<AdsMutationResponse> {
    if (
      dto.amount === undefined &&
      dto.businessDate === undefined
    ) {
      throw new ConflictException(
        'No ADS changes were provided.',
      );
    }

    const existing =
      await this.findEntry(
        auth.companyId,
        adsEntryId,
      );

    if (
      existing.status !==
      AdsEntryStatus.ACTIVE
    ) {
      throw new ConflictException(
        'Canceled ADS cannot be edited.',
      );
    }

    const newBusinessDate =
      dto.businessDate
        ? parseBusinessDate(
            dto.businessDate,
          )
        : existing.businessDate;

    const oldDate =
      formatBusinessDate(
        existing.businessDate,
      );

    const newDate =
      formatBusinessDate(
        newBusinessDate,
      );

    const effectiveFrom =
      oldDate < newDate
        ? oldDate
        : newDate;

    const updated =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const result =
              await tx.adsEntry.update({
                where: {
                  id:
                    existing.id,
                },

                data: {
                  ...(dto.amount !==
                  undefined
                    ? {
                        amount:
                          dto.amount,
                      }
                    : {}),

                  ...(dto.businessDate !==
                  undefined
                    ? {
                        businessDate:
                          newBusinessDate,
                      }
                    : {}),
                },
              });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'ads.updated',

                entityType:
                  'AdsEntry',

                entityId:
                  result.id,

                before: {
                  employeeId:
                    existing.employeeId,

                  businessDate:
                    oldDate,

                  amount:
                    existing.amount
                      .toFixed(2),

                  status:
                    existing.status,
                },

                after: {
                  employeeId:
                    result.employeeId,

                  businessDate:
                    newDate,

                  amount:
                    result.amount
                      .toFixed(2),

                  status:
                    result.status,
                },
              },
            });

            await tx.outboxEvent
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  eventType:
                    'ads.changed',

                  aggregateType:
                    'AdsEntry',

                  aggregateId:
                    result.id,

                  payload: {
                    operation:
                      'UPDATED',

                    employeeId:
                      result.employeeId,

                    previousBusinessDate:
                      oldDate,

                    businessDate:
                      newDate,

                    effectiveFrom,
                  },
                },
              });

            return result;
          },
        );

    const recalculated =
      await this.recalculation
        .tryRecalculateEmployeeFrom(
          updated.employeeId,
          effectiveFrom,
        );

    return {
      adsEntry:
        this.toView(updated),

      recalculation: {
        status:
          recalculated
            ? 'COMPLETED'
            : 'PENDING',

        effectiveFrom,
      },
    };
  }

  async cancel(
    auth: AuthContext,
    adsEntryId: string,
  ): Promise<AdsMutationResponse> {
    const existing =
      await this.findEntry(
        auth.companyId,
        adsEntryId,
      );

    const effectiveFrom =
      formatBusinessDate(
        existing.businessDate,
      );

    if (
      existing.status ===
      AdsEntryStatus.CANCELED
    ) {
      return {
        adsEntry:
          this.toView(existing),

        recalculation: {
          status:
            'COMPLETED',

          effectiveFrom,
        },
      };
    }

    const canceled =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const result =
              await tx.adsEntry.update({
                where: {
                  id:
                    existing.id,
                },

                data: {
                  status:
                    AdsEntryStatus.CANCELED,

                  canceledAt:
                    new Date(),
                },
              });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'ads.canceled',

                entityType:
                  'AdsEntry',

                entityId:
                  result.id,

                before: {
                  status:
                    existing.status,

                  amount:
                    existing.amount
                      .toFixed(2),

                  businessDate:
                    effectiveFrom,
                },

                after: {
                  status:
                    result.status,

                  canceledAt:
                    result.canceledAt
                      ?.toISOString() ??
                    null,
                },
              },
            });

            await tx.outboxEvent
              .create({
                data: {
                  companyId:
                    auth.companyId,

                  eventType:
                    'ads.changed',

                  aggregateType:
                    'AdsEntry',

                  aggregateId:
                    result.id,

                  payload: {
                    operation:
                      'CANCELED',

                    employeeId:
                      result.employeeId,

                    effectiveFrom,
                  },
                },
              });

            return result;
          },
        );

    const recalculated =
      await this.recalculation
        .tryRecalculateEmployeeFrom(
          canceled.employeeId,
          effectiveFrom,
        );

    return {
      adsEntry:
        this.toView(canceled),

      recalculation: {
        status:
          recalculated
            ? 'COMPLETED'
            : 'PENDING',

        effectiveFrom,
      },
    };
  }

  private async assertEmployee(
    companyId: string,
    employeeId: string,
  ): Promise<void> {
    const employee =
      await this.database.prisma
        .employee.findFirst({
          where: {
            id:
              employeeId,

            user: {
              companyId,

              role:
                UserRole.EMPLOYEE,
            },
          },

          select: {
            id: true,
          },
        });

    if (!employee) {
      throw new NotFoundException(
        'Employee not found.',
      );
    }
  }

  private async findEntry(
    companyId: string,
    adsEntryId: string,
  ) {
    const entry =
      await this.database.prisma
        .adsEntry.findFirst({
          where: {
            id:
              adsEntryId,

            companyId,
          },
        });

    if (!entry) {
      throw new NotFoundException(
        'ADS entry not found.',
      );
    }

    return entry;
  }

  private toView(
    entry: {
      id: string;

      companyId: string;
      employeeId: string;

      businessDate: Date;

      amount: {
        toFixed(
          decimalPlaces: number,
        ): string;
      };

      status:
        AdsEntryStatus;

      canceledAt:
        | Date
        | null;

      createdAt: Date;
      updatedAt: Date;
    },
  ): AdsEntryView {
    return {
      id:
        entry.id,

      companyId:
        entry.companyId,

      employeeId:
        entry.employeeId,

      businessDate:
        formatBusinessDate(
          entry.businessDate,
        ),

      amount:
        entry.amount.toFixed(2),

      status:
        entry.status,

      canceledAt:
        entry.canceledAt
          ?.toISOString() ??
        null,

      createdAt:
        entry.createdAt
          .toISOString(),

      updatedAt:
        entry.updatedAt
          .toISOString(),
    };
  }
}