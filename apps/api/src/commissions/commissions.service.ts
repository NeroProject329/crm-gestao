import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  EmployeeCommissionPolicyView,
} from '@crm/contracts';

import {
  UserRole,
} from '@crm/database';

import {
  DatabaseService,
} from '../database/database.service';

import type {
  AuthContext,
} from '../auth/auth-context';

import {
  formatBusinessDate,
  parseBusinessDate,
  previousBusinessDate,
} from '../common/business-date';

import type {
  SetCommissionDto,
} from './dto/set-commission.dto';

@Injectable()
export class CommissionsService {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async list(
    companyId: string,
    employeeId: string,
  ): Promise<
    EmployeeCommissionPolicyView[]
  > {
    await this.assertEmployee(
      companyId,
      employeeId,
    );

    const policies =
      await this.database.prisma
        .employeeCommissionPolicy
        .findMany({
          where: {
            employeeId,
          },

          orderBy: {
            effectiveFrom:
              'desc',
          },
        });

    return policies.map(
      (policy) =>
        this.toView(policy),
    );
  }

  async set(
    auth: AuthContext,
    employeeId: string,
    dto: SetCommissionDto,
  ): Promise<EmployeeCommissionPolicyView> {
    await this.assertEmployee(
      auth.companyId,
      employeeId,
    );

    const effectiveFrom =
      parseBusinessDate(
        dto.effectiveFrom,
        'effectiveFrom',
      );

    const policy =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            const covering =
              await tx
                .employeeCommissionPolicy
                .findFirst({
                  where: {
                    employeeId,

                    effectiveFrom: {
                      lte:
                        effectiveFrom,
                    },

                    OR: [
                      {
                        effectiveUntil:
                          null,
                      },
                      {
                        effectiveUntil: {
                          gte:
                            effectiveFrom,
                        },
                      },
                    ],
                  },

                  orderBy: {
                    effectiveFrom:
                      'desc',
                  },
                });

            if (
              covering &&
              covering.effectiveFrom
                .getTime() ===
                effectiveFrom.getTime()
            ) {
              const updated =
                await tx
                  .employeeCommissionPolicy
                  .update({
                    where: {
                      id:
                        covering.id,
                    },

                    data: {
                      percentageBps:
                        dto.percentageBps,
                    },
                  });

              await tx.auditLog.create({
                data: {
                  companyId:
                    auth.companyId,

                  actorUserId:
                    auth.userId,

                  action:
                    'employee-commission-policy.updated',

                  entityType:
                    'EmployeeCommissionPolicy',

                  entityId:
                    updated.id,

                  before: {
                    employeeId,

                    percentageBps:
                      covering.percentageBps,

                    effectiveFrom:
                      formatBusinessDate(
                        covering.effectiveFrom,
                      ),
                  },

                  after: {
                    employeeId,

                    percentageBps:
                      updated.percentageBps,

                    effectiveFrom:
                      dto.effectiveFrom,
                  },
                },
              });

              await this.createOutbox(
                tx,
                auth,
                employeeId,
                updated.id,
                dto.effectiveFrom,
              );

              return updated;
            }

            if (covering) {
              const oldEnd =
                covering.effectiveUntil;

              await tx
                .employeeCommissionPolicy
                .update({
                  where: {
                    id:
                      covering.id,
                  },

                  data: {
                    effectiveUntil:
                      previousBusinessDate(
                        effectiveFrom,
                      ),
                  },
                });

              const created =
                await tx
                  .employeeCommissionPolicy
                  .create({
                    data: {
                      employeeId,

                      percentageBps:
                        dto.percentageBps,

                      effectiveFrom,

                      effectiveUntil:
                        oldEnd,
                    },
                  });

              await tx.auditLog.create({
                data: {
                  companyId:
                    auth.companyId,

                  actorUserId:
                    auth.userId,

                  action:
                    'employee-commission-policy.created',

                  entityType:
                    'EmployeeCommissionPolicy',

                  entityId:
                    created.id,

                  after: {
                    employeeId,

                    percentageBps:
                      created.percentageBps,

                    effectiveFrom:
                      dto.effectiveFrom,

                    effectiveUntil:
                      oldEnd
                        ? formatBusinessDate(
                            oldEnd,
                          )
                        : null,
                  },
                },
              });

              await this.createOutbox(
                tx,
                auth,
                employeeId,
                created.id,
                dto.effectiveFrom,
              );

              return created;
            }

            const next =
              await tx
                .employeeCommissionPolicy
                .findFirst({
                  where: {
                    employeeId,

                    effectiveFrom: {
                      gt:
                        effectiveFrom,
                    },
                  },

                  orderBy: {
                    effectiveFrom:
                      'asc',
                  },
                });

            const created =
              await tx
                .employeeCommissionPolicy
                .create({
                  data: {
                    employeeId,

                    percentageBps:
                      dto.percentageBps,

                    effectiveFrom,

                    effectiveUntil:
                      next
                        ? previousBusinessDate(
                            next.effectiveFrom,
                          )
                        : null,
                  },
                });

            await tx.auditLog.create({
              data: {
                companyId:
                  auth.companyId,

                actorUserId:
                  auth.userId,

                action:
                  'employee-commission-policy.created',

                entityType:
                  'EmployeeCommissionPolicy',

                entityId:
                  created.id,

                after: {
                  employeeId,

                  percentageBps:
                    created.percentageBps,

                  effectiveFrom:
                    dto.effectiveFrom,

                  effectiveUntil:
                    created.effectiveUntil
                      ? formatBusinessDate(
                          created.effectiveUntil,
                        )
                      : null,
                },
              },
            });

            await this.createOutbox(
              tx,
              auth,
              employeeId,
              created.id,
              dto.effectiveFrom,
            );

            return created;
          },
        );

    return this.toView(
      policy,
    );
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

  private async createOutbox(
    tx: {
      outboxEvent: {
        create(args: {
          data: {
            companyId: string;
            eventType: string;
            aggregateType: string;
            aggregateId: string;
            payload: {
              scope: string;
              employeeId: string;
              effectiveFrom: string;
            };
          };
        }): Promise<unknown>;
      };
    },

    auth: AuthContext,
    employeeId: string,
    policyId: string,
    effectiveFrom: string,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        companyId:
          auth.companyId,

        eventType:
          'employee-commission-policy.changed',

        aggregateType:
          'EmployeeCommissionPolicy',

        aggregateId:
          policyId,

        payload: {
          scope:
            'EMPLOYEE',

          employeeId,

          effectiveFrom,
        },
      },
    });
  }

  private toView(
    policy: {
      id: string;

      employeeId: string;

      percentageBps: number;

      effectiveFrom: Date;

      effectiveUntil:
        | Date
        | null;

      createdAt: Date;
    },
  ): EmployeeCommissionPolicyView {
    return {
      id:
        policy.id,

      employeeId:
        policy.employeeId,

      percentageBps:
        policy.percentageBps,

      effectiveFrom:
        formatBusinessDate(
          policy.effectiveFrom,
        ),

      effectiveUntil:
        policy.effectiveUntil
          ? formatBusinessDate(
              policy.effectiveUntil,
            )
          : null,

      createdAt:
        policy.createdAt
          .toISOString(),
    };
  }
}