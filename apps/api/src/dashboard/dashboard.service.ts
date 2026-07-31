import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  EmployeeDashboardPreset,
  EmployeeDashboardView,
  EmployeeFinancialDayView,
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
    EmployeeDashboardPreset;

  from: Date;
  to: Date;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async employeeDashboard(
    companyId: string,
    employeeId: string,
    query: {
      preset:
        DashboardPresetDto;

      from?: string;
      to?: string;
    },
  ): Promise<EmployeeDashboardView> {
    /* =====================================================
       EMPLOYEE
    ===================================================== */

    const employee =
      await this.database.prisma
        .employee.findFirst({
          where: {
            id:
              employeeId,

            active:
              true,

            user: {
              companyId,

              role:
                'EMPLOYEE',

              status:
                'ACTIVE',
            },
          },

          select: {
            id: true,

            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        });

    if (!employee) {
      throw new NotFoundException(
        'Employee not found.',
      );
    }

    /* =====================================================
       COMPANY SETTINGS
    ===================================================== */

    const settings =
      await this.database.prisma
        .companySettings
        .findUnique({
          where: {
            companyId,
          },

          select: {
            timezone: true,

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
       DAILY FINANCIAL RESULTS

       Fonte:
       DailyFinancialResult

       Aqui NÃO recalculamos dinheiro.
       O Financial Engine + Worker já produziram
       esses resultados.
    ===================================================== */

    const results =
      await this.database.prisma
        .dailyFinancialResult
        .findMany({
          where: {
            companyId,

            employeeId,

            businessDate: {
              gte:
                period.from,

              lte:
                period.to,
            },
          },

          orderBy: {
            businessDate:
              'asc',
          },

          select: {
            businessDate:
              true,

            approvedRevenue:
              true,

            bankCost:
              true,

            adsCost:
              true,

            employeeAmount:
              true,

            openingAdsDebt:
              true,

            closingAdsDebt:
              true,

            status:
              true,
          },
        });

    /* =====================================================
       TOTALS

       A soma acontece no PostgreSQL usando Decimal.

       Não transformamos dinheiro em Number/float.
    ===================================================== */

    const totals =
      await this.database.prisma
        .dailyFinancialResult
        .aggregate({
          where: {
            companyId,

            employeeId,

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
          },
        });

    const zero =
      '0.00';

    const first =
      results.at(0);

    const last =
      results.at(-1);

    /* =====================================================
       DAILY VIEW

       IMPORTANTE:
       adminProfit propositalmente NÃO é selecionado,
       NÃO é processado e NÃO é retornado.
    ===================================================== */

    const days:
      EmployeeFinancialDayView[] =
        results.map(
          (
            result,
          ): EmployeeFinancialDayView => ({
            businessDate:
              formatBusinessDate(
                result
                  .businessDate,
              ),

            approvedRevenue:
              result
                .approvedRevenue
                .toFixed(2),

            bankCost:
              result
                .bankCost
                .toFixed(2),

            adsCost:
              result
                .adsCost
                .toFixed(2),

            employeeAmount:
              result
                .employeeAmount
                .toFixed(2),

            openingAdsDebt:
              result
                .openingAdsDebt
                .toFixed(2),

            closingAdsDebt:
              result
                .closingAdsDebt
                .toFixed(2),

            status:
              result.status,
          }),
        );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return {
      employee: {
        employeeId:
          employee.id,

        name:
          employee.user.name,

        email:
          employee.user.email,
      },

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
            ?.toFixed(2) ??
          zero,

        bankCost:
          totals
            ._sum
            .bankCost
            ?.toFixed(2) ??
          zero,

        adsCost:
          totals
            ._sum
            .adsCost
            ?.toFixed(2) ??
          zero,

        employeeAmount:
          totals
            ._sum
            .employeeAmount
            ?.toFixed(2) ??
          zero,

        openingAdsDebt:
          first
            ? first
                .openingAdsDebt
                .toFixed(2)
            : zero,

        closingAdsDebt:
          last
            ? last
                .closingAdsDebt
                .toFixed(2)
            : zero,

        status:
          this.resolveStatus(
            last?.status,
          ),
      },

      days,
    };
  }

  /* =======================================================
     PERIOD RESOLUTION
  ======================================================= */

  private resolvePeriod(
    input: {
      preset:
        DashboardPresetDto;

      from?: string;
      to?: string;

      timezone: string;

      weekStartDay:
        number;
    },
  ): ResolvedPeriod {
    /* -----------------------------------------------------
       CUSTOM
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       CURRENT BUSINESS DATE

       Determinado pelo timezone da empresa.
    ----------------------------------------------------- */

    const todayString =
      businessDateInTimezone(
        new Date(),
        input.timezone,
      );

    const today =
      parseBusinessDate(
        todayString,
      );

    /* -----------------------------------------------------
       TODAY
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       WEEK
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       YEAR
    ----------------------------------------------------- */

    if (
      input.preset ===
      DashboardPresetDto.YEAR
    ) {
      const from =
        new Date(
          Date.UTC(
            today
              .getUTCFullYear(),

            0,

            1,
          ),
        );

      return {
        preset:
          'YEAR',

        from,

        to:
          today,
      };
    }

    /* -----------------------------------------------------
       MONTH

       Também funciona como fallback/default.
    ----------------------------------------------------- */

    const from =
      new Date(
        Date.UTC(
          today
            .getUTCFullYear(),

          today
            .getUTCMonth(),

          1,
        ),
      );

    return {
      preset:
        'MONTH',

      from,

      to:
        today,
    };
  }

  /* =======================================================
     CUSTOM RANGE LIMIT
  ======================================================= */

  private assertMaximumRange(
    from: Date,
    to: Date,
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
      ) + 1;

    if (
      days >
      366
    ) {
      throw new BadRequestException(
        'Dashboard range cannot exceed 366 days.',
      );
    }
  }

  /* =======================================================
     CURRENT STATUS
  ======================================================= */

  private resolveStatus(
    value:
      | EmployeeFinancialStatus
      | undefined,
  ): EmployeeFinancialStatus {
    return (
      value ??
      'ZERO'
    );
  }
}