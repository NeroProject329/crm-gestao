import { calculateDay } from './calculate-day';

import {
  moneyString,
  ZERO_MONEY,
} from './money';

import type {
  BusinessDate,
  DailyFinancialResult,
  MoneyString,
  RecalculationDayInput,
  RecalculationSummary,
} from './types';

export interface FinancialRecalculationRepository {
  /**
   * Retorna a data financeira atual da empresa.
   * A implementação futura deve respeitar CompanySettings.timezone.
   */
  getCurrentBusinessDate(
    employeeId: string,
  ): Promise<BusinessDate>;

  /**
   * Busca a última closingAdsDebt anterior a startDate.
   * Na ausência de histórico, retorna null.
   */
  getClosingAdsDebtBefore(
    employeeId: string,
    startDate: BusinessDate,
  ): Promise<MoneyString | null>;

  /**
   * Coleta as fontes do dia:
   * APPROVED receipts + ADS + políticas vigentes.
   */
  getDayInput(
    employeeId: string,
    businessDate: BusinessDate,
  ): Promise<RecalculationDayInput>;

  /**
   * Persiste/materializa DailyFinancialResult.
   * A implementação deve fazer upsert por employeeId + businessDate.
   */
  saveDailyResult(
    employeeId: string,
    businessDate: BusinessDate,
    result: DailyFinancialResult,
  ): Promise<void>;
}

export class RecalculationService {
  constructor(
    private readonly repository:
      FinancialRecalculationRepository,
  ) {}

  async recalculateEmployeeFrom(
    employeeId: string,
    startDate: BusinessDate,
  ): Promise<RecalculationSummary> {
    if (!employeeId.trim()) {
      throw new Error('employeeId is required.');
    }

    validateBusinessDate(startDate);

    const endDate =
      await this.repository.getCurrentBusinessDate(
        employeeId,
      );

    validateBusinessDate(endDate);

    if (startDate > endDate) {
      throw new Error(
        'startDate cannot be after current business date.',
      );
    }

    let openingAdsDebt = moneyString(
      (await this.repository.getClosingAdsDebtBefore(
        employeeId,
        startDate,
      )) ?? ZERO_MONEY,
    );

    let processedDays = 0;

    for (const businessDate of businessDateRange(
      startDate,
      endDate,
    )) {
      const dayInput =
        await this.repository.getDayInput(
          employeeId,
          businessDate,
        );

      const result = calculateDay({
        approvedRevenue:
          dayInput.approvedRevenue,

        bankFeePercentageBps:
          dayInput.bankFeePercentageBps,

        adsCost:
          dayInput.adsCost,

        openingAdsDebt,

        employeeCommissionPercentageBps:
          dayInput.employeeCommissionPercentageBps,
      });

      await this.repository.saveDailyResult(
        employeeId,
        businessDate,
        result,
      );

      openingAdsDebt = result.closingAdsDebt;

      processedDays += 1;
    }

    return {
      employeeId,
      startDate,
      endDate,
      processedDays,
      closingAdsDebt: openingAdsDebt,
    };
  }
}

function validateBusinessDate(
  value: BusinessDate,
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(
      `Invalid business date: ${value}. Expected YYYY-MM-DD.`,
    );
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(
      `Invalid business date: ${value}.`,
    );
  }
}

function* businessDateRange(
  startDate: BusinessDate,
  endDate: BusinessDate,
): Generator<BusinessDate> {
  const current = new Date(
    `${startDate}T00:00:00.000Z`,
  );

  const end = new Date(
    `${endDate}T00:00:00.000Z`,
  );

  while (current <= end) {
    yield current
      .toISOString()
      .slice(0, 10);

    current.setUTCDate(
      current.getUTCDate() + 1,
    );
  }
}