import type {
  DatabaseService,
} from '../database/database.service';

import {
  DashboardPresetDto,
} from './dto/dashboard-query.dto';

import {
  DashboardService,
} from './dashboard.service';

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
  'DashboardService employee security',
  () => {
    it(
      'never selects or returns adminProfit for EMPLOYEE',
      async () => {
        const findResults =
          jest.fn();

        const aggregate =
          jest.fn();

        const database = {
          prisma: {
            employee: {
              findFirst:
                jest
                  .fn()
                  .mockResolvedValue({
                    id:
                      'employee-1',

                    user: {
                      name:
                        'Funcionário',

                      email:
                        'employee@example.com',
                    },
                  }),
            },

            companySettings: {
              findUnique:
                jest
                  .fn()
                  .mockResolvedValue({
                    timezone:
                      'America/Sao_Paulo',

                    weekStartDay:
                      1,
                  }),
            },

            dailyFinancialResult: {
              findMany:
                findResults,

              aggregate,
            },
          },
        };

        findResults.mockResolvedValue([
          {
            businessDate:
              new Date(
                '2026-07-31T00:00:00.000Z',
              ),

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
             * Mesmo que um mock tente inserir
             * esse campo, o mapping da view não
             * deve utilizá-lo.
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

            status:
              'POSITIVE',
          },
        ]);

        aggregate.mockResolvedValue({
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

            employeeAmount:
              money(
                '187.50',
              ),

            /*
             * Deliberadamente presente no mock.
             */
            adminProfit:
              money(
                '562.50',
              ),
          },
        });

        const service =
          new DashboardService(
            database as unknown as
              DatabaseService,
          );

        const response =
          await service
            .employeeDashboard(
              'company-1',

              'employee-1',

              {
                preset:
                  DashboardPresetDto.TODAY,
              },
            );

        expect(
          JSON.stringify(
            response,
          ),
        ).not.toContain(
          'adminProfit',
        );

        const findCall =
          findResults.mock
            .calls[0]?.[0];

        expect(
          findCall
            ?.select,
        ).not.toHaveProperty(
          'adminProfit',
        );

        const aggregateCall =
          aggregate.mock
            .calls[0]?.[0];

        expect(
          aggregateCall
            ?._sum,
        ).not.toHaveProperty(
          'adminProfit',
        );
      },
    );
  },
);