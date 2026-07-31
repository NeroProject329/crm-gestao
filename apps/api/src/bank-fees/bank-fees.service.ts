import {
  Injectable,
} from '@nestjs/common';

import type {
  BankFeePolicyView,
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
  previousBusinessDate,
} from '../common/business-date';

import type {
  SetBankFeeDto,
} from './dto/set-bank-fee.dto';

@Injectable()
export class BankFeesService {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async list(
    companyId: string,
  ): Promise<BankFeePolicyView[]> {
    const policies =
      await this.database.prisma
        .bankFeePolicy.findMany({
          where: {
            companyId,
          },

          orderBy: {
            effectiveFrom: 'desc',
          },
        });

    return policies.map(
      (policy) =>
        this.toView(policy),
    );
  }

  async set(
    auth: AuthContext,
    dto: SetBankFeeDto,
  ): Promise<BankFeePolicyView> {
    const effectiveFrom =
      parseBusinessDate(
        dto.effectiveFrom,
        'effectiveFrom',
      );

    const policy =
      await this.database.prisma
        .$transaction(
          async (tx) => {
            /*
             * Procura uma política cujo
             * intervalo contenha a data.
             */
            const covering =
              await tx.bankFeePolicy
                .findFirst({
                  where: {
                    companyId:
                      auth.companyId,

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

            /*
             * A política já começa
             * exatamente nessa data:
             * alteramos esse segmento.
             */
            if (
              covering &&
              covering.effectiveFrom
                .getTime() ===
                effectiveFrom.getTime()
            ) {
              const updated =
                await tx.bankFeePolicy
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
                    'bank-fee-policy.updated',

                  entityType:
                    'BankFeePolicy',

                  entityId:
                    updated.id,

                  before: {
                    percentageBps:
                      covering.percentageBps,

                    effectiveFrom:
                      formatBusinessDate(
                        covering.effectiveFrom,
                      ),
                  },

                  after: {
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
                updated.id,
                dto.effectiveFrom,
              );

              return updated;
            }

            /*
             * Estamos mudando no meio
             * de uma vigência existente.
             *
             * Ex:
             * 01/01 -> infinito = 15%
             *
             * set 01/08 = 17%
             *
             * vira:
             * 01/01 -> 31/07 = 15%
             * 01/08 -> infinito = 17%
             */
            if (covering) {
              const oldEnd =
                covering.effectiveUntil;

              await tx.bankFeePolicy
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
                await tx.bankFeePolicy
                  .create({
                    data: {
                      companyId:
                        auth.companyId,

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
                    'bank-fee-policy.created',

                  entityType:
                    'BankFeePolicy',

                  entityId:
                    created.id,

                  after: {
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
                created.id,
                dto.effectiveFrom,
              );

              return created;
            }

            /*
             * Nenhuma política cobre
             * a data. Encontramos a
             * próxima política futura.
             */
            const next =
              await tx.bankFeePolicy
                .findFirst({
                  where: {
                    companyId:
                      auth.companyId,

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
              await tx.bankFeePolicy
                .create({
                  data: {
                    companyId:
                      auth.companyId,

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
                  'bank-fee-policy.created',

                entityType:
                  'BankFeePolicy',

                entityId:
                  created.id,

                after: {
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
              effectiveFrom: string;
            };
          };
        }): Promise<unknown>;
      };
    },
    auth: AuthContext,
    policyId: string,
    effectiveFrom: string,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        companyId:
          auth.companyId,

        eventType:
          'bank-fee-policy.changed',

        aggregateType:
          'BankFeePolicy',

        aggregateId:
          policyId,

        payload: {
          scope:
            'ALL_EMPLOYEES',

          effectiveFrom,
        },
      },
    });
  }

  private toView(
    policy: {
      id: string;

      percentageBps: number;

      effectiveFrom: Date;
      effectiveUntil:
        | Date
        | null;

      createdAt: Date;
    },
  ): BankFeePolicyView {
    return {
      id:
        policy.id,

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