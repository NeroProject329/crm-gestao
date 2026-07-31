import {
  AdsEntryStatus,
  PaymentReceiptStatus,
  type Prisma,
} from '@crm/database';

import type {
  BusinessDate,
  DailyFinancialResult,
  FinancialRecalculationRepository,
  MoneyString,
  RecalculationDayInput,
} from '@crm/financial-engine';

import {
  businessDateInTimezone,
  parseBusinessDate,
} from '../common/business-date';

interface EmployeeContext {
  companyId: string;
  timezone: string;
}

export class PrismaFinancialRecalculationRepository
  implements
    FinancialRecalculationRepository
{
  private readonly contexts =
    new Map<
      string,
      EmployeeContext
    >();

  constructor(
    private readonly prisma:
      Prisma.TransactionClient,
  ) {}

  async getCurrentBusinessDate(
    employeeId: string,
  ): Promise<BusinessDate> {
    const context =
      await this
        .getEmployeeContext(
          employeeId,
        );

    return businessDateInTimezone(
      new Date(),
      context.timezone,
    );
  }

  async getClosingAdsDebtBefore(
    employeeId: string,
    startDate:
      BusinessDate,
  ): Promise<
    MoneyString | null
  > {
    const result =
      await this.prisma
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
            businessDate:
              'desc',
          },

          select: {
            closingAdsDebt:
              true,
          },
        });

    return result
      ? result
          .closingAdsDebt
          .toFixed(2)
      : null;
  }

  async getDayInput(
    employeeId: string,
    businessDate:
      BusinessDate,
  ): Promise<
    RecalculationDayInput
  > {
    const context =
      await this
        .getEmployeeContext(
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
    ] =
      await Promise.all([
        this.prisma
          .paymentReceipt
          .aggregate({
            where: {
              employeeId,

              businessDate:
                date,

              status:
                PaymentReceiptStatus.APPROVED,
            },

            _sum: {
              amount:
                true,
            },
          }),

        this.prisma
          .adsEntry
          .aggregate({
            where: {
              employeeId,

              businessDate:
                date,

              status:
                AdsEntryStatus.ACTIVE,
            },

            _sum: {
              amount:
                true,
            },
          }),

        this.prisma
          .bankFeePolicy
          .findFirst({
            where: {
              companyId:
                context
                  .companyId,

              effectiveFrom: {
                lte:
                  date,
              },

              OR: [
                {
                  effectiveUntil:
                    null,
                },

                {
                  effectiveUntil: {
                    gte:
                      date,
                  },
                },
              ],
            },

            orderBy: {
              effectiveFrom:
                'desc',
            },

            select: {
              percentageBps:
                true,
            },
          }),

        this.prisma
          .employeeCommissionPolicy
          .findFirst({
            where: {
              employeeId,

              effectiveFrom: {
                lte:
                  date,
              },

              OR: [
                {
                  effectiveUntil:
                    null,
                },

                {
                  effectiveUntil: {
                    gte:
                      date,
                  },
                },
              ],
            },

            orderBy: {
              effectiveFrom:
                'desc',
            },

            select: {
              percentageBps:
                true,
            },
          }),
      ]);

    if (!bankFeePolicy) {
      throw new Error(
        `BankFeePolicy not found for employee ${employeeId} on ${businessDate}.`,
      );
    }

    if (!commissionPolicy) {
      throw new Error(
        `EmployeeCommissionPolicy not found for employee ${employeeId} on ${businessDate}.`,
      );
    }

    return {
      approvedRevenue:
        receiptAggregate
          ._sum
          .amount
          ?.toFixed(2) ??
        '0.00',

      bankFeePercentageBps:
        bankFeePolicy
          .percentageBps,

      adsCost:
        adsAggregate
          ._sum
          .amount
          ?.toFixed(2) ??
        '0.00',

      employeeCommissionPercentageBps:
        commissionPolicy
          .percentageBps,
    };
  }

  async saveDailyResult(
    employeeId: string,
    businessDate:
      BusinessDate,
    result:
      DailyFinancialResult,
  ): Promise<void> {
    const context =
      await this
        .getEmployeeContext(
          employeeId,
        );

    const date =
      parseBusinessDate(
        businessDate,
      );

    const data = {
      companyId:
        context.companyId,

      employeeId,

      businessDate:
        date,

      approvedRevenue:
        result
          .approvedRevenue,

      bankFeePercentageBps:
        result
          .bankFeePercentageBps,

      bankCost:
        result.bankCost,

      revenueAfterBank:
        result
          .revenueAfterBank,

      adsCost:
        result.adsCost,

      openingAdsDebt:
        result
          .openingAdsDebt,

      resultBeforeCommission:
        result
          .resultBeforeCommission,

      employeeCommissionPercentageBps:
        result
          .employeeCommissionPercentageBps,

      employeeAmount:
        result
          .employeeAmount,

      adminProfit:
        result
          .adminProfit,

      closingAdsDebt:
        result
          .closingAdsDebt,

      status:
        result.status,

      calculatedAt:
        new Date(),
    };

    await this.prisma
      .dailyFinancialResult
      .upsert({
        where: {
          employeeId_businessDate:
            {
              employeeId,

              businessDate:
                date,
            },
        },

        create:
          data,

        update:
          data,
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
      await this.prisma
        .employee
        .findUnique({
          where: {
            id:
              employeeId,
          },

          select: {
            user: {
              select: {
                companyId:
                  true,

                company: {
                  select: {
                    settings: {
                      select: {
                        timezone:
                          true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

    if (!employee) {
      throw new Error(
        `Employee not found: ${employeeId}.`,
      );
    }

    const timezone =
      employee
        .user
        .company
        .settings
        ?.timezone;

    if (!timezone) {
      throw new Error(
        `Company timezone not found for employee ${employeeId}.`,
      );
    }

    const context = {
      companyId:
        employee
          .user
          .companyId,

      timezone,
    };

    this.contexts.set(
      employeeId,
      context,
    );

    return context;
  }
}