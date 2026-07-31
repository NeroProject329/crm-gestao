import {
  WeeklySettlementStatus,
} from '@crm/database';

import type {
  DatabaseService,
} from '../database/database.service';

import {
  SettlementsService,
} from './settlements.service';

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
  'SettlementsService security',
  () => {
    it(
      'always uses authenticated employeeId and never exposes adminProfit',
      async () => {
        const findMany =
          jest.fn();

        const database = {
          prisma: {
            weeklySettlement: {
              findMany,
            },
          },
        };

        const service =
          new SettlementsService(
            database as unknown as
              DatabaseService,
          );

        findMany.mockResolvedValue([
          {
            id:
              'settlement-1',

            employeeId:
              'employee-session',

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

            employeeAmount:
              money(
                '187.50',
              ),

            /*
             * Simulamos inclusive um objeto contendo
             * adminProfit para garantir que a camada
             * de projeção nunca o devolva.
             */
            adminProfit:
              money(
                '562.50',
              ),

            openingAdsDebt:
              money(
                '0.00',
              ),

            closingAdsDebt:
              money(
                '0.00',
              ),

            closedAt:
              new Date(
                '2026-08-02T20:00:00.000Z',
              ),

            paidAt:
              new Date(
                '2026-08-03T12:00:00.000Z',
              ),

            createdAt:
              new Date(
                '2026-07-27T00:00:00.000Z',
              ),

            updatedAt:
              new Date(
                '2026-08-03T12:00:00.000Z',
              ),
          },
        ]);

        const result =
          await service.listMy(
            'company-1',

            'employee-session',

            {
              /*
               * Tentativa maliciosa de consultar
               * outro funcionário.
               *
               * listMy deve ignorar isso.
               */
              employeeId:
                'employee-attacker-target',
            },
          );

        expect(
          findMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                companyId:
                  'company-1',

                employeeId:
                  'employee-session',
              }),
          }),
        );

        const databaseQuery =
          findMany.mock
            .calls[0]?.[0];

        expect(
          databaseQuery
            ?.where
            ?.employeeId,
        ).not.toBe(
          'employee-attacker-target',
        );

        expect(
          result,
        ).toHaveLength(
          1,
        );

        expect(
          result[0],
        ).not.toHaveProperty(
          'adminProfit',
        );

        expect(
          JSON.stringify(
            result,
          ),
        ).not.toContain(
          'adminProfit',
        );
      },
    );
  },
);