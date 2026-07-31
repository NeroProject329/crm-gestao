import {
  FinancialAdjustmentType,
  WeeklySettlementStatus,
  type Prisma,
} from '@crm/database';

import type {
  BusinessDate,
} from '@crm/financial-engine';

import {
  SettlementReconciliationService,
} from './settlement-reconciliation.service';

function money(
  value:
    string,
) {
  return {
    toFixed:
      jest
        .fn()
        .mockReturnValue(
          value,
        ),
  };
}

describe(
  'SettlementReconciliationService',
  () => {
    it(
      'keeps PAID immutable and creates only the residual adjustment once',
      async () => {
        const weeklyUpdate =
          jest.fn();

        const adjustmentCreate =
          jest
            .fn()
            .mockResolvedValue({
              id:
                'adjustment-1',
            });

        const adjustmentFindMany =
          jest.fn()
            /*
             * Primeira execução:
             * ainda não existe ajuste.
             */
            .mockResolvedValueOnce(
              [],
            )
            /*
             * Retry:
             * CREDIT de 20 já existe.
             */
            .mockResolvedValueOnce([
              {
                type:
                  FinancialAdjustmentType.CREDIT,

                amount:
                  money(
                    '20.00',
                  ),
              },
            ]);

        const dailyFindFirst =
          jest.fn(
            async (
              args:
                {
                  orderBy?: {
                    businessDate?:
                      'asc' |
                      'desc';
                  };
                },
            ) => {
              if (
                args
                  .orderBy
                  ?.businessDate ===
                'asc'
              ) {
                return {
                  openingAdsDebt:
                    money(
                      '0.00',
                    ),
                };
              }

              return {
                closingAdsDebt:
                  money(
                    '0.00',
                  ),
              };
            },
          );

        const tx = {
          employee: {
            findUnique:
              jest
                .fn()
                .mockResolvedValue({
                  id:
                    'employee-1',

                  user: {
                    companyId:
                      'company-1',
                  },
                }),
          },

          weeklySettlement: {
            findMany:
              jest
                .fn()
                .mockResolvedValue([
                  {
                    id:
                      'settlement-1',

                    companyId:
                      'company-1',

                    employeeId:
                      'employee-1',

                    periodStart:
                      new Date(
                        '2026-07-27T00:00:00.000Z',
                      ),

                    periodEnd:
                      new Date(
                        '2026-08-02T00:00:00.000Z',
                      ),

                    status:
                      WeeklySettlementStatus.PAID,

                    /*
                     * Snapshot realmente pago.
                     */
                    employeeAmount:
                      money(
                        '100.00',
                      ),
                  },
                ]),

            update:
              weeklyUpdate,
          },

          dailyFinancialResult: {
            aggregate:
              jest
                .fn()
                .mockResolvedValue({
                  _sum: {
                    approvedRevenue:
                      money(
                        '1000.00',
                      ),

                    bankCost:
                      money(
                        '150.00',
                      ),

                    adsCost:
                      money(
                        '100.00',
                      ),

                    /*
                     * Verdade financeira recalculada.
                     */
                    employeeAmount:
                      money(
                        '120.00',
                      ),

                    adminProfit:
                      money(
                        '630.00',
                      ),
                  },
                }),

            findFirst:
              dailyFindFirst,
          },

          financialAdjustment: {
            findMany:
              adjustmentFindMany,

            create:
              adjustmentCreate,
          },

          auditLog: {
            create:
              jest
                .fn()
                .mockResolvedValue({
                  id:
                    'audit-1',
                }),
          },
        };

        const service =
          new SettlementReconciliationService();

        const startDate =
          '2026-07-31' as
            BusinessDate;

        const transaction =
          tx as unknown as
            Prisma.TransactionClient;

        /*
         * Primeira execução.
         */
        await service
          .reconcileAfterRecalculation(
            transaction,

            'employee-1',

            startDate,

            {
              type:
                'receipt.approved',

              id:
                'event-1',
            },
          );

        /*
         * PAID não pode ser alterado.
         */
        expect(
          weeklyUpdate,
        ).not.toHaveBeenCalled();

        expect(
          adjustmentCreate,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          adjustmentCreate,
        ).toHaveBeenCalledWith({
          data:
            expect.objectContaining({
              companyId:
                'company-1',

              employeeId:
                'employee-1',

              settlementId:
                'settlement-1',

              type:
                FinancialAdjustmentType.CREDIT,

              amount:
                '20.00',

              originType:
                'PAID_SETTLEMENT_RECALC',

              originId:
                'event-1',

              createdByUserId:
                null,
            }),
        });

        /*
         * Simula retry do Outbox/recalculation.
         *
         * Agora o CREDIT 20 já está no banco.
         */
        await service
          .reconcileAfterRecalculation(
            transaction,

            'employee-1',

            startDate,

            {
              type:
                'receipt.approved',

              id:
                'event-1',
            },
          );

        /*
         * Continua existindo somente 1 criação.
         */
        expect(
          adjustmentCreate,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * Settlement PAID segue intocado.
         */
        expect(
          weeklyUpdate,
        ).not.toHaveBeenCalled();
      },
    );
  },
);