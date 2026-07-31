import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  AdsEntryStatus,
  PaymentReceiptStatus,
} from '@crm/database';

import type {
  BusinessDate,
  DailyFinancialResult,
  FinancialRecalculationRepository,
  MoneyString,
  RecalculationDayInput,
} from '@crm/financial-engine';

import {
  DatabaseService,
} from '../database/database.service';

import {
  formatBusinessDate,
  parseBusinessDate,
} from '../common/business-date';

interface EmployeeContext {
  companyId: string;
  timezone: string;
}

@Injectable()
export class PrismaFinancialRecalculationRepository
  implements FinancialRecalculationRepository
{
  private readonly contexts =
    new Map<string, EmployeeContext>();

  constructor(
    private readonly database:
      DatabaseService,
  ) {}

  async getCurrentBusinessDate(
    employeeId: string,
  ): Promise<BusinessDate> {
    const context =
      await this.getEmployeeContext(
        employeeId,
      );

    return this.currentDateInTimezone(
      context.timezone,
    );
  }

  async getClosingAdsDebtBefore(
    employeeId: string,
    startDate: BusinessDate,
  ): Promise<MoneyString | null> {
    const result =
      await this.database.prisma
        .dailyFinancialResult
        .findFirst({
          where: {
            employeeId,

            businessDate: {
              lt:
                parseBusinessDate(
                  startDate,
                ),
            },
          },

          orderBy: {
            businessDate: 'desc',
          },

          select: {
            closingAdsDebt: true,
          },
        });

    return result
      ? result.closingAdsDebt.toFixed(2)
      : null;
  }

  async getDayInput(
    employeeId: string,
    businessDate: BusinessDate,
  ): Promise<RecalculationDayInput> {
    const context =
      await this.getEmployeeContext(
        employeeId,
      );

    const date =
      parseBusinessDate(
        businessDate,
      );

    const [
      receiptAggregate,
      adsAggregate,
      bankFeePolicy,
      commissionPolicy,
    ] = await Promise.all([
      this.database.prisma
        .paymentReceipt.aggregate({
          where: {
            employeeId,
            businessDate: date,
            status:
              PaymentReceiptStatus.APPROVED,
          },

          _sum: {
            amount: true,
          },
        }),

      this.database.prisma
        .adsEntry.aggregate({
          where: {
            employeeId,
            businessDate: date,
            status:
              AdsEntryStatus.ACTIVE,
          },

          _sum: {
            amount: true,
          },
        }),

      this.database.prisma
        .bankFeePolicy.findFirst({
          where: {
            companyId:
              context.companyId,

            effectiveFrom: {
              lte: date,
            },

            OR: [
              {
                effectiveUntil:
                  null,
              },
              {
                effectiveUntil: {
                  gte: date,
                },
              },
            ],
          },

          orderBy: {
            effectiveFrom:
              'desc',
          },
        }),

      this.database.prisma
        .employeeCommissionPolicy
        .findFirst({
          where: {
            employeeId,

            effectiveFrom: {
              lte: date,
            },

            OR: [
              {
                effectiveUntil:
                  null,
              },
              {
                effectiveUntil: {
                  gte: date,
                },
              },
            ],
          },

          orderBy: {
            effectiveFrom:
              'desc',
          },
        }),
    ]);

    if (!bankFeePolicy) {
      throw new UnprocessableEntityException(
        `Bank fee policy not found for ${businessDate}.`,
      );
    }

    if (!commissionPolicy) {
      throw new UnprocessableEntityException(
        `Commission policy not found for ${businessDate}.`,
      );
    }

    return {
      approvedRevenue:
        receiptAggregate._sum.amount
          ?.toFixed(2) ??
        '0.00',

      bankFeePercentageBps:
        bankFeePolicy.percentageBps,

      adsCost:
        adsAggregate._sum.amount
          ?.toFixed(2) ??
        '0.00',

      employeeCommissionPercentageBps:
        commissionPolicy.percentageBps,
    };
  }

  async saveDailyResult(
    employeeId: string,
    businessDate: BusinessDate,
    result: DailyFinancialResult,
  ): Promise<void> {
    const context =
      await this.getEmployeeContext(
        employeeId,
      );

    const date =
      parseBusinessDate(
        businessDate,
      );

    await this.database.prisma
      .dailyFinancialResult
      .upsert({
        where: {
          employeeId_businessDate: {
            employeeId,
            businessDate:
              date,
          },
        },

        update: {
          companyId:
            context.companyId,

          approvedRevenue:
            result.approvedRevenue,

          bankFeePercentageBps:
            result.bankFeePercentageBps,

          bankCost:
            result.bankCost,

          revenueAfterBank:
            result.revenueAfterBank,

          adsCost:
            result.adsCost,

          openingAdsDebt:
            result.openingAdsDebt,

          resultBeforeCommission:
            result.resultBeforeCommission,

          employeeCommissionPercentageBps:
            result.employeeCommissionPercentageBps,

          employeeAmount:
            result.employeeAmount,

          adminProfit:
            result.adminProfit,

          closingAdsDebt:
            result.closingAdsDebt,

          status:
            result.status,

          calculatedAt:
            new Date(),
        },

        create: {
          companyId:
            context.companyId,

          employeeId,

          businessDate:
            date,

          approvedRevenue:
            result.approvedRevenue,

          bankFeePercentageBps:
            result.bankFeePercentageBps,

          bankCost:
            result.bankCost,

          revenueAfterBank:
            result.revenueAfterBank,

          adsCost:
            result.adsCost,

          openingAdsDebt:
            result.openingAdsDebt,

          resultBeforeCommission:
            result.resultBeforeCommission,

          employeeCommissionPercentageBps:
            result.employeeCommissionPercentageBps,

          employeeAmount:
            result.employeeAmount,

          adminProfit:
            result.adminProfit,

          closingAdsDebt:
            result.closingAdsDebt,

          status:
            result.status,

          calculatedAt:
            new Date(),
        },
      });
  }

  private async getEmployeeContext(
    employeeId: string,
  ): Promise<EmployeeContext> {
    const cached =
      this.contexts.get(
        employeeId,
      );

    if (cached) {
      return cached;
    }

    const employee =
      await this.database.prisma
        .employee.findUnique({
          where: {
            id: employeeId,
          },

          include: {
            user: {
              include: {
                company: {
                  include: {
                    settings: true,
                  },
                },
              },
            },
          },
        });

    if (!employee) {
      throw new NotFoundException(
        'Employee not found.',
      );
    }

    const context: EmployeeContext = {
      companyId:
        employee.user.companyId,

      timezone:
        employee.user.company
          .settings?.timezone ??
        'America/Sao_Paulo',
    };

    this.contexts.set(
      employeeId,
      context,
    );

    return context;
  }

  private currentDateInTimezone(
    timezone: string,
  ): BusinessDate {
    const parts =
      new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone: timezone,

          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        },
      ).formatToParts(
        new Date(),
      );

    const year =
      parts.find(
        (part) =>
          part.type === 'year',
      )?.value;

    const month =
      parts.find(
        (part) =>
          part.type === 'month',
      )?.value;

    const day =
      parts.find(
        (part) =>
          part.type === 'day',
      )?.value;

    if (
      !year ||
      !month ||
      !day
    ) {
      throw new Error(
        'Unable to resolve current business date.',
      );
    }

    return `${year}-${month}-${day}`;
  }
}