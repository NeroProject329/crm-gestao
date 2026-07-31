import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import type {
  AdminDashboardView,
  AdminEmployeeFinancialView,
  AdminRankingItemView,
  DashboardPreset,
  EmployeeFinancialStatus,
} from '@crm/contracts';

import {
  DatabaseService,
} from '../database/database.service';

import {
  businessDateInTimezone,
  formatBusinessDate,
  parseBusinessDate,
} from '../common/business-date';

import {
  DashboardPresetDto,
} from './dto/dashboard-query.dto';

interface ResolvedPeriod {
  preset:
    DashboardPreset;

  from:
    Date;

  to:
    Date;
}

interface DashboardQuery {
  preset:
    DashboardPresetDto;

  from?:
    string;

  to?:
    string;
}

/* =========================================================
   EXACT MONEY HELPERS

   Apenas agregação do read model.

   Nenhum cálculo da fórmula financeira acontece aqui.
========================================================= */

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
  value:
    bigint,
): string {
  const negative =
    value <
    0n;

  const absolute =
    negative
      ? -value
      : value;

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
export class AdminDashboardService {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async adminDashboard(
    companyId:
      string,

    query:
      DashboardQuery,
  ): Promise<AdminDashboardView> {
    /* =====================================================
       COMPANY SETTINGS
    ===================================================== */

    const settings =
      await this.database
        .prisma
        .companySettings
        .findUnique({
          where: {
            companyId,
          },

          select: {
            timezone:
              true,

            weekStartDay:
              true,
          },
        });

    if (!settings) {
      throw new Error(
        'Company settings not found.',
      );
    }

    /* =====================================================
       PERIOD
    ===================================================== */

    const period =
      this.resolvePeriod({
        preset:
          query.preset,

        from:
          query.from,

        to:
          query.to,

        timezone:
          settings.timezone,

        weekStartDay:
          settings.weekStartDay,
      });

    /* =====================================================
       READ MODELS

       DailyFinancialResult continua sendo
       a verdade da consulta financeira.

       employeeAmount = custo do funcionário
       adminProfit    = lucro administrativo
    ===================================================== */

    const [
      totals,
      daily,
      employeePeriodTotals,
      employees,
      pendingReceipts,
    ] =
      await Promise.all([
        this.database
          .prisma
          .dailyFinancialResult
          .aggregate({
            where: {
              companyId,

              businessDate: {
                gte:
                  period.from,

                lte:
                  period.to,
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

        this.database
          .prisma
          .dailyFinancialResult
          .groupBy({
            by: [
              'businessDate',
            ],

            where: {
              companyId,

              businessDate: {
                gte:
                  period.from,

                lte:
                  period.to,
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

            orderBy: {
              businessDate:
                'asc',
            },
          }),

        this.database
          .prisma
          .dailyFinancialResult
          .groupBy({
            by: [
              'employeeId',
            ],

            where: {
              companyId,

              businessDate: {
                gte:
                  period.from,

                lte:
                  period.to,
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

        this.database
          .prisma
          .employee
          .findMany({
            where: {
              user: {
                companyId,

                role:
                  'EMPLOYEE',
              },
            },

            select: {
              id:
                true,

              active:
                true,

              user: {
                select: {
                  name:
                    true,

                  email:
                    true,

                  status:
                    true,
                },
              },

              /*
               * Fonte oficial da dívida atual:
               * closingAdsDebt do último
               * DailyFinancialResult.
               */
              dailyFinancialResults: {
                take:
                  1,

                orderBy: {
                  businessDate:
                    'desc',
                },

                select: {
                  closingAdsDebt:
                    true,

                  status:
                    true,
                },
              },
            },

            orderBy: {
              createdAt:
                'asc',
            },
          }),

        this.database
          .prisma
          .paymentReceipt
          .count({
            where: {
              companyId,

              status:
                'PENDING',
            },
          }),
      ]);

    const zero =
      '0.00';

    /* =====================================================
       EMPLOYEE PERIOD MAP
    ===================================================== */

    const periodMap =
      new Map(
        employeePeriodTotals
          .map(
            (
              result,
            ) => [
              result.employeeId,
              result,
            ] as const,
          ),
      );

    /* =====================================================
       PER EMPLOYEE VIEW
    ===================================================== */

    const employeeViews:
      AdminEmployeeFinancialView[] =
        employees.map(
          (
            employee,
          ) => {
            const periodTotals =
              periodMap.get(
                employee.id,
              );

            const latest =
              employee
                .dailyFinancialResults[
                  0
                ];

            const active =
              employee.active &&
              employee.user
                .status ===
                'ACTIVE';

            return {
              employeeId:
                employee.id,

              name:
                employee
                  .user
                  .name,

              email:
                employee
                  .user
                  .email,

              active,

              approvedRevenue:
                periodTotals
                  ?._sum
                  .approvedRevenue
                  ?.toFixed(
                    2,
                  ) ??
                zero,

              bankCost:
                periodTotals
                  ?._sum
                  .bankCost
                  ?.toFixed(
                    2,
                  ) ??
                zero,

              adsCost:
                periodTotals
                  ?._sum
                  .adsCost
                  ?.toFixed(
                    2,
                  ) ??
                zero,

              employeeAmount:
                periodTotals
                  ?._sum
                  .employeeAmount
                  ?.toFixed(
                    2,
                  ) ??
                zero,

              adminProfit:
                periodTotals
                  ?._sum
                  .adminProfit
                  ?.toFixed(
                    2,
                  ) ??
                zero,

              currentAdsDebt:
                latest
                  ?.closingAdsDebt
                  .toFixed(
                    2,
                  ) ??
                zero,

              status:
                this.resolveStatus(
                  latest?.status,
                ),
            };
          },
        );

    /*
     * Ranking oficial:
     * maior faturamento APPROVED do período.
     *
     * Comparação feita em centavos BigInt.
     * Nunca Number/float para dinheiro.
     */

    employeeViews.sort(
      (
        left,
        right,
      ) => {
        const leftRevenue =
          moneyToCents(
            left.approvedRevenue,
          );

        const rightRevenue =
          moneyToCents(
            right.approvedRevenue,
          );

        if (
          leftRevenue ===
          rightRevenue
        ) {
          return left.name
            .localeCompare(
              right.name,
              'pt-BR',
            );
        }

        return rightRevenue >
          leftRevenue
          ? 1
          : -1;
      },
    );

    const ranking:
      AdminRankingItemView[] =
        employeeViews.map(
          (
            employee,
            index,
          ) => ({
            position:
              index +
              1,

            employeeId:
              employee
                .employeeId,

            name:
              employee.name,

            email:
              employee.email,

            active:
              employee.active,

            approvedRevenue:
              employee
                .approvedRevenue,

            employeeAmount:
              employee
                .employeeAmount,

            adminProfit:
              employee
                .adminProfit,

            currentAdsDebt:
              employee
                .currentAdsDebt,

            status:
              employee.status,
          }),
        );

    /* =====================================================
       CURRENT COMPANY ADS DEBT

       Soma exata das dívidas atuais dos funcionários.

       A dívida atual NÃO depende do filtro de período.
    ===================================================== */

    const currentAdsDebtCents =
      employeeViews.reduce(
        (
          total,
          employee,
        ) =>
          total +
          moneyToCents(
            employee
              .currentAdsDebt,
          ),

        0n,
      );

    /* =====================================================
       DAILY COMPANY VIEW
    ===================================================== */

    const days =
      daily.map(
        (
          result,
        ) => ({
          businessDate:
            formatBusinessDate(
              result
                .businessDate,
            ),

          approvedRevenue:
            result
              ._sum
              .approvedRevenue
              ?.toFixed(
                2,
              ) ??
            zero,

          bankCost:
            result
              ._sum
              .bankCost
              ?.toFixed(
                2,
              ) ??
            zero,

          adsCost:
            result
              ._sum
              .adsCost
              ?.toFixed(
                2,
              ) ??
            zero,

          employeeAmount:
            result
              ._sum
              .employeeAmount
              ?.toFixed(
                2,
              ) ??
            zero,

          adminProfit:
            result
              ._sum
              .adminProfit
              ?.toFixed(
                2,
              ) ??
            zero,
        }),
      );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return {
      period: {
        preset:
          period.preset,

        from:
          formatBusinessDate(
            period.from,
          ),

        to:
          formatBusinessDate(
            period.to,
          ),
      },

      summary: {
        approvedRevenue:
          totals
            ._sum
            .approvedRevenue
            ?.toFixed(
              2,
            ) ??
          zero,

        bankCost:
          totals
            ._sum
            .bankCost
            ?.toFixed(
              2,
            ) ??
          zero,

        adsCost:
          totals
            ._sum
            .adsCost
            ?.toFixed(
              2,
            ) ??
          zero,

        employeeAmount:
          totals
            ._sum
            .employeeAmount
            ?.toFixed(
              2,
            ) ??
          zero,

        adminProfit:
          totals
            ._sum
            .adminProfit
            ?.toFixed(
              2,
            ) ??
          zero,

        currentAdsDebt:
          centsToMoney(
            currentAdsDebtCents,
          ),

        totalEmployees:
          employeeViews.length,

        activeEmployees:
          employeeViews
            .filter(
              (
                employee,
              ) =>
                employee.active,
            )
            .length,

        pendingReceipts,
      },

      days,

      employees:
        employeeViews,

      ranking,
    };
  }

  /* =======================================================
     PERIOD
  ======================================================= */

  private resolvePeriod(
    input: {
      preset:
        DashboardPresetDto;

      from?:
        string;

      to?:
        string;

      timezone:
        string;

      weekStartDay:
        number;
    },
  ): ResolvedPeriod {
    if (
      input.preset ===
      DashboardPresetDto.CUSTOM
    ) {
      if (
        !input.from ||
        !input.to
      ) {
        throw new BadRequestException(
          'from and to are required for CUSTOM preset.',
        );
      }

      const from =
        parseBusinessDate(
          input.from,
          'from',
        );

      const to =
        parseBusinessDate(
          input.to,
          'to',
        );

      if (
        from.getTime() >
        to.getTime()
      ) {
        throw new BadRequestException(
          'from must be less than or equal to to.',
        );
      }

      this.assertMaximumRange(
        from,
        to,
      );

      return {
        preset:
          'CUSTOM',

        from,
        to,
      };
    }

    const todayString =
      businessDateInTimezone(
        new Date(),
        input.timezone,
      );

    const today =
      parseBusinessDate(
        todayString,
      );

    if (
      input.preset ===
      DashboardPresetDto.TODAY
    ) {
      return {
        preset:
          'TODAY',

        from:
          today,

        to:
          today,
      };
    }

    if (
      input.preset ===
      DashboardPresetDto.WEEK
    ) {
      const from =
        new Date(
          today,
        );

      const weekday =
        from.getUTCDay();

      const distance =
        (
          weekday -
          input.weekStartDay +
          7
        ) % 7;

      from.setUTCDate(
        from.getUTCDate() -
          distance,
      );

      return {
        preset:
          'WEEK',

        from,

        to:
          today,
      };
    }

    if (
      input.preset ===
      DashboardPresetDto.YEAR
    ) {
      return {
        preset:
          'YEAR',

        from:
          new Date(
            Date.UTC(
              today
                .getUTCFullYear(),

              0,

              1,
            ),
          ),

        to:
          today,
      };
    }

    return {
      preset:
        'MONTH',

      from:
        new Date(
          Date.UTC(
            today
              .getUTCFullYear(),

            today
              .getUTCMonth(),

            1,
          ),
        ),

      to:
        today,
    };
  }

  private assertMaximumRange(
    from:
      Date,

    to:
      Date,
  ): void {
    const dayMs =
      24 *
      60 *
      60 *
      1000;

    const days =
      Math.floor(
        (
          to.getTime() -
          from.getTime()
        ) /
          dayMs,
      ) +
      1;

    if (
      days >
      366
    ) {
      throw new BadRequestException(
        'Dashboard range cannot exceed 366 days.',
      );
    }
  }

  private resolveStatus(
    status:
      | EmployeeFinancialStatus
      | undefined,
  ): EmployeeFinancialStatus {
    return (
      status ??
      'ZERO'
    );
  }
}