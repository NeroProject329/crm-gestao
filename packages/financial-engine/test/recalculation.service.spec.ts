import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  RecalculationService,
} from '../src';

import type {
  BusinessDate,
  DailyFinancialResult,
  FinancialRecalculationRepository,
  RecalculationDayInput,
} from '../src';

class FakeRepository
  implements FinancialRecalculationRepository
{
  readonly saved = new Map<
    BusinessDate,
    DailyFinancialResult
  >();

  async getCurrentBusinessDate(): Promise<BusinessDate> {
    return '2026-01-02';
  }

  async getClosingAdsDebtBefore(): Promise<string | null> {
    return null;
  }

  async getDayInput(
    _employeeId: string,
    businessDate: BusinessDate,
  ): Promise<RecalculationDayInput> {
    if (businessDate === '2026-01-01') {
      return {
        approvedRevenue: '500.00',
        bankFeePercentageBps: 1500,
        adsCost: '600.00',
        employeeCommissionPercentageBps: 2500,
      };
    }

    return {
      approvedRevenue: '2000.00',
      bankFeePercentageBps: 1500,
      adsCost: '500.00',
      employeeCommissionPercentageBps: 2500,
    };
  }

  async saveDailyResult(
    _employeeId: string,
    businessDate: BusinessDate,
    result: DailyFinancialResult,
  ): Promise<void> {
    this.saved.set(
      businessDate,
      result,
    );
  }
}

describe('RecalculationService', () => {
  it('propaga a dívida cronologicamente', async () => {
    const repository =
      new FakeRepository();

    const service =
      new RecalculationService(
        repository,
      );

    const summary =
      await service.recalculateEmployeeFrom(
        'employee-1',
        '2026-01-01',
      );

    const firstDay =
      repository.saved.get(
        '2026-01-01',
      );

    const secondDay =
      repository.saved.get(
        '2026-01-02',
      );

    expect(firstDay).toBeDefined();
    expect(secondDay).toBeDefined();

    expect(
      firstDay?.closingAdsDebt,
    ).toBe('175.00');

    expect(
      secondDay?.openingAdsDebt,
    ).toBe('175.00');

    expect(
      secondDay?.resultBeforeCommission,
    ).toBe('1025.00');

    expect(
      secondDay?.employeeAmount,
    ).toBe('256.25');

    expect(
      secondDay?.adminProfit,
    ).toBe('768.75');

    expect(
      secondDay?.closingAdsDebt,
    ).toBe('0.00');

    expect(summary.processedDays).toBe(2);
    expect(summary.closingAdsDebt).toBe(
      '0.00',
    );
  });
});