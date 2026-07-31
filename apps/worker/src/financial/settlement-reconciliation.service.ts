import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  FinancialAdjustmentType,
  WeeklySettlementStatus,
  type Prisma,
} from '@crm/database';

import type {
  BusinessDate,
} from '@crm/financial-engine';

import {
  parseBusinessDate,
  toBusinessDate,
} from '../common/business-date';

export interface RecalculationOrigin {
  type: string;

  id:
    | string
    | null;
}

interface SettlementTotals {
  approvedRevenue: string;

  bankCost: string;

  adsCost: string;

  employeeAmount: string;

  adminProfit: string;

  openingAdsDebt: string;

  closingAdsDebt: string;
}

function moneyToCents(
  value:
    string,
): bigint {
  const match =
    /^(-?)(\d+)(?:\.(\d{1,2}))?$/
      .exec(
        value.trim(),
      );

  if (!match) {
    throw new Error(
      `Invalid monetary value: ${value}`,
    );
  }

  const sign =
    match[1] === '-'
      ? -1n
      : 1n;

  const whole =
    BigInt(
      match[2],
    );

  const decimals =
    (
      match[3] ??
      ''
    )
      .padEnd(
        2,
        '0',
      );

  return (
    whole *
      100n +
    BigInt(
      decimals ||
        '0',
    )
  ) * sign;
}

function centsToMoney(
  cents:
    bigint,
): string {
  const negative =
    cents <
    0n;

  const absolute =
    negative
      ? -cents
      : cents;

  const whole =
    absolute /
    100n;

  const decimals =
    (
      absolute %
      100n
    )
      .toString()
      .padStart(
        2,
        '0',
      );

  return `${
    negative
      ? '-'
      : ''
  }${whole}.${decimals}`;
}

@Injectable()
export class SettlementReconciliationService {
  private readonly logger =
    new Logger(
      SettlementReconciliationService.name,
    );

  async reconcileAfterRecalculation(
    tx:
      Prisma.TransactionClient,

    employeeId:
      string,

    startDate:
      BusinessDate,

    origin?:
      RecalculationOrigin,
  ): Promise<void> {
    const employee =
      await tx.employee
        .findUnique({
          where: {
            id:
              employeeId,
          },

          select: {
            id:
              true,

            user: {
              select: {
                companyId:
                  true,
              },
            },
          },
        });

    if (!employee) {
      throw new Error(
        `Employee not found during settlement reconciliation: ${employeeId}.`,
      );
    }

    const companyId =
      employee
        .user
        .companyId;

    const affected =
      await tx
        .weeklySettlement
        .findMany({
          where: {
            companyId,

            employeeId,

            periodEnd: {
              gte:
                parseBusinessDate(
                  startDate,
                ),
            },
          },

          orderBy: {
            periodStart:
              'asc',
          },
        });

    for (
      const settlement
      of affected
    ) {
      const totals =
        await this
          .aggregatePeriod(
            tx,
            companyId,
            employeeId,
            settlement
              .periodStart,
            settlement
              .periodEnd,
          );

      /* ===================================================
         OPEN

         Continua vivo.
      =================================================== */

      if (
        settlement.status ===
        WeeklySettlementStatus.OPEN
      ) {
        await tx
          .weeklySettlement
          .update({
            where: {
              id:
                settlement.id,
            },

            data: {
              approvedRevenue:
                totals
                  .approvedRevenue,

              bankCost:
                totals
                  .bankCost,

              adsCost:
                totals
                  .adsCost,

              employeeAmount:
                totals
                  .employeeAmount,

              adminProfit:
                totals
                  .adminProfit,

              openingAdsDebt:
                totals
                  .openingAdsDebt,

              closingAdsDebt:
                totals
                  .closingAdsDebt,
            },
          });

        continue;
      }

      /* ===================================================
         CLOSED

         Não sobrescrevemos silenciosamente.

         Havendo diferença, exige revisão.
      =================================================== */

      if (
        settlement.status ===
        WeeklySettlementStatus.CLOSED
      ) {
        if (
          this.snapshotChanged(
            settlement,
            totals,
          )
        ) {
          await tx
            .weeklySettlement
            .update({
              where: {
                id:
                  settlement.id,
              },

              data: {
                status:
                  WeeklySettlementStatus.REVIEW_REQUIRED,
              },
            });

          await tx.auditLog
            .create({
              data: {
                companyId,

                actorUserId:
                  null,

                action:
                  'settlement.review-required',

                entityType:
                  'WeeklySettlement',

                entityId:
                  settlement.id,

                before: {
                  status:
                    settlement.status,

                  approvedRevenue:
                    settlement
                      .approvedRevenue
                      .toFixed(
                        2,
                      ),

                  bankCost:
                    settlement
                      .bankCost
                      .toFixed(
                        2,
                      ),

                  adsCost:
                    settlement
                      .adsCost
                      .toFixed(
                        2,
                      ),

                  employeeAmount:
                    settlement
                      .employeeAmount
                      .toFixed(
                        2,
                      ),

                  adminProfit:
                    settlement
                      .adminProfit
                      .toFixed(
                        2,
                      ),

                  openingAdsDebt:
                    settlement
                      .openingAdsDebt
                      .toFixed(
                        2,
                      ),

                  closingAdsDebt:
                    settlement
                      .closingAdsDebt
                      .toFixed(
                        2,
                      ),
                },

                after: {
                  status:
                    WeeklySettlementStatus.REVIEW_REQUIRED,

                  recalculatedApprovedRevenue:
                    totals
                      .approvedRevenue,

                  recalculatedBankCost:
                    totals
                      .bankCost,

                  recalculatedAdsCost:
                    totals
                      .adsCost,

                  recalculatedEmployeeAmount:
                    totals
                      .employeeAmount,

                  recalculatedAdminProfit:
                    totals
                      .adminProfit,

                  recalculatedOpeningAdsDebt:
                    totals
                      .openingAdsDebt,

                  recalculatedClosingAdsDebt:
                    totals
                      .closingAdsDebt,
                },
              },
            });

          this.logger.warn(
            JSON.stringify({
              event:
                'settlement.review-required',

              settlementId:
                settlement.id,

              employeeId,

              periodStart:
                toBusinessDate(
                  settlement
                    .periodStart,
                ),

              periodEnd:
                toBusinessDate(
                  settlement
                    .periodEnd,
                ),
            }),
          );
        }

        continue;
      }

      /* ===================================================
         REVIEW_REQUIRED

         Snapshot permanece intacto até ADMIN revisar.
      =================================================== */

      if (
        settlement.status ===
        WeeklySettlementStatus.REVIEW_REQUIRED
      ) {
        continue;
      }

      /* ===================================================
         PAID

         Imutável.

         Calculamos somente a diferença de employeeAmount.

         O histórico do pagamento não é reescrito.
      =================================================== */

      if (
        settlement.status ===
        WeeklySettlementStatus.PAID
      ) {
        await this
          .reconcilePaidSettlement(
            tx,
            settlement,
            totals,
            origin,
          );
      }
    }
  }

  /* =======================================================
     PAID ADJUSTMENT

     desiredDifference:
       resultado correto atual
       -
       valor que foi efetivamente fechado/pago

     existingDifference:
       ajustes já gerados anteriormente

     residual:
       o que ainda precisa ser conciliado

     Isso torna retries idempotentes.
  ======================================================= */

  private async reconcilePaidSettlement(
    tx:
      Prisma.TransactionClient,

    settlement: {
      id: string;

      companyId: string;

      employeeId: string;

      periodStart: Date;
      periodEnd: Date;

      employeeAmount: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };
    },

    totals:
      SettlementTotals,

    origin?:
      RecalculationOrigin,
  ): Promise<void> {
    const originalCents =
      moneyToCents(
        settlement
          .employeeAmount
          .toFixed(
            2,
          ),
      );

    const recalculatedCents =
      moneyToCents(
        totals
          .employeeAmount,
      );

    const desiredDifference =
      recalculatedCents -
      originalCents;

    const existingAdjustments =
      await tx
        .financialAdjustment
        .findMany({
          where: {
            settlementId:
              settlement.id,

            originType:
              'PAID_SETTLEMENT_RECALC',
          },

          select: {
            type:
              true,

            amount:
              true,
          },
        });

    const existingDifference =
      existingAdjustments
        .reduce(
          (
            total,
            adjustment,
          ) => {
            const cents =
              moneyToCents(
                adjustment
                  .amount
                  .toFixed(
                    2,
                  ),
              );

            return adjustment
              .type ===
              FinancialAdjustmentType.CREDIT
              ? total +
                  cents
              : total -
                  cents;
          },

          0n,
        );

    const residual =
      desiredDifference -
      existingDifference;

    /*
     * Já conciliado.
     *
     * Também torna retry do mesmo
     * OutboxEvent seguro.
     */
    if (
      residual ===
      0n
    ) {
      return;
    }

    const type =
      residual >
      0n
        ? FinancialAdjustmentType.CREDIT
        : FinancialAdjustmentType.DEBIT;

    const amountCents =
      residual >
      0n
        ? residual
        : -residual;

    const amount =
      centsToMoney(
        amountCents,
      );

    const period =
      `${
        toBusinessDate(
          settlement
            .periodStart,
        )
      } a ${
        toBusinessDate(
          settlement
            .periodEnd,
        )
      }`;

    const created =
      await tx
        .financialAdjustment
        .create({
          data: {
            companyId:
              settlement
                .companyId,

            employeeId:
              settlement
                .employeeId,

            /*
             * O settlement pago é o fechamento
             * corrigido por este ajuste.
             */
            settlementId:
              settlement.id,

            type,

            amount,

            reason:
              `Reconciliação automática do fechamento pago (${period}).`,

            /*
             * Categoria estável para sabermos
             * quais ajustes entram no saldo
             * automático dessa reconciliação.
             */
            originType:
              'PAID_SETTLEMENT_RECALC',

            /*
             * ID real do evento que causou
             * essa nova diferença.
             */
            originId:
              origin
                ?.id ??
              null,

            createdByUserId:
              null,
          },
        });

    await tx.auditLog
      .create({
        data: {
          companyId:
            settlement
              .companyId,

          actorUserId:
            null,

          action:
            'settlement.adjustment-created',

          entityType:
            'FinancialAdjustment',

          entityId:
            created.id,

          after: {
            settlementId:
              settlement.id,

            employeeId:
              settlement
                .employeeId,

            type,

            amount,

            sourceEventType:
              origin
                ?.type ??
              'financial.recalculation',

            sourceEventId:
              origin
                ?.id ??
              null,
          },
        },
      });

    this.logger.warn(
      JSON.stringify({
        event:
          'settlement.adjustment-created',

        adjustmentId:
          created.id,

        settlementId:
          settlement.id,

        employeeId:
          settlement
            .employeeId,

        type,

        amount,
      }),
    );
  }

  /* =======================================================
     AGGREGATION

     Apenas DailyFinancialResult.
  ======================================================= */

  private async aggregatePeriod(
    tx:
      Prisma.TransactionClient,

    companyId:
      string,

    employeeId:
      string,

    periodStart:
      Date,

    periodEnd:
      Date,
  ): Promise<
    SettlementTotals
  > {
    const [
      aggregate,
      first,
      last,
    ] =
      await Promise.all([
        tx.dailyFinancialResult
          .aggregate({
            where: {
              companyId,

              employeeId,

              businessDate: {
                gte:
                  periodStart,

                lte:
                  periodEnd,
              },
            },

            _sum: {
              approvedRevenue:
                true,

              bankCost:
                true,

              adsCost:
                true,

              employeeAmount:
                true,

              adminProfit:
                true,
            },
          }),

        tx.dailyFinancialResult
          .findFirst({
            where: {
              companyId,

              employeeId,

              businessDate: {
                gte:
                  periodStart,

                lte:
                  periodEnd,
              },
            },

            orderBy: {
              businessDate:
                'asc',
            },

            select: {
              openingAdsDebt:
                true,
            },
          }),

        tx.dailyFinancialResult
          .findFirst({
            where: {
              companyId,

              employeeId,

              businessDate: {
                gte:
                  periodStart,

                lte:
                  periodEnd,
              },
            },

            orderBy: {
              businessDate:
                'desc',
            },

            select: {
              closingAdsDebt:
                true,
            },
          }),
      ]);

    return {
      approvedRevenue:
        aggregate
          ._sum
          .approvedRevenue
          ?.toFixed(
            2,
          ) ??
        '0.00',

      bankCost:
        aggregate
          ._sum
          .bankCost
          ?.toFixed(
            2,
          ) ??
        '0.00',

      adsCost:
        aggregate
          ._sum
          .adsCost
          ?.toFixed(
            2,
          ) ??
        '0.00',

      employeeAmount:
        aggregate
          ._sum
          .employeeAmount
          ?.toFixed(
            2,
          ) ??
        '0.00',

      adminProfit:
        aggregate
          ._sum
          .adminProfit
          ?.toFixed(
            2,
          ) ??
        '0.00',

      openingAdsDebt:
        first
          ?.openingAdsDebt
          .toFixed(
            2,
          ) ??
        '0.00',

      closingAdsDebt:
        last
          ?.closingAdsDebt
          .toFixed(
            2,
          ) ??
        '0.00',
    };
  }

  private snapshotChanged(
    settlement: {
      approvedRevenue: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      bankCost: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      adsCost: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      employeeAmount: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      adminProfit: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      openingAdsDebt: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };

      closingAdsDebt: {
        toFixed(
          decimalPlaces:
            number,
        ): string;
      };
    },

    totals:
      SettlementTotals,
  ): boolean {
    return (
      settlement
        .approvedRevenue
        .toFixed(
          2,
        ) !==
        totals
          .approvedRevenue ||

      settlement
        .bankCost
        .toFixed(
          2,
        ) !==
        totals
          .bankCost ||

      settlement
        .adsCost
        .toFixed(
          2,
        ) !==
        totals
          .adsCost ||

      settlement
        .employeeAmount
        .toFixed(
          2,
        ) !==
        totals
          .employeeAmount ||

      settlement
        .adminProfit
        .toFixed(
          2,
        ) !==
        totals
          .adminProfit ||

      settlement
        .openingAdsDebt
        .toFixed(
          2,
        ) !==
        totals
          .openingAdsDebt ||

      settlement
        .closingAdsDebt
        .toFixed(
          2,
        ) !==
        totals
          .closingAdsDebt
    );
  }
}