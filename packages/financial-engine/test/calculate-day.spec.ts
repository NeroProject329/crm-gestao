import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateDay,
  validateBasisPoints,
} from '../src';

describe('calculateDay', () => {
  it('calcula exatamente o caso positivo oficial', () => {
    const result = calculateDay({
      approvedRevenue: '5000.00',
      bankFeePercentageBps: 1500,
      adsCost: '523.33',
      openingAdsDebt: '0.00',
      employeeCommissionPercentageBps: 2500,
    });

    expect(result.bankCost).toBe('750.00');
    expect(result.revenueAfterBank).toBe('4250.00');

    expect(
      result.resultBeforeCommission,
    ).toBe('3726.67');

    expect(result.employeeAmount).toBe(
      '931.67',
    );

    expect(result.adminProfit).toBe(
      '2795.00',
    );

    expect(result.closingAdsDebt).toBe(
      '0.00',
    );

    expect(result.status).toBe('POSITIVE');
  });

  it('gera dívida ADS', () => {
    const result = calculateDay({
      approvedRevenue: '500.00',
      bankFeePercentageBps: 1500,
      adsCost: '600.00',
      openingAdsDebt: '0.00',
      employeeCommissionPercentageBps: 2500,
    });

    expect(result.bankCost).toBe('75.00');

    expect(
      result.resultBeforeCommission,
    ).toBe('-175.00');

    expect(result.employeeAmount).toBe(
      '0.00',
    );

    expect(result.adminProfit).toBe(
      '0.00',
    );

    expect(result.closingAdsDebt).toBe(
      '175.00',
    );

    expect(result.status).toBe('ADS_DEBT');
  });

  it('absorve dívida anterior antes da comissão', () => {
    const result = calculateDay({
      approvedRevenue: '2000.00',
      bankFeePercentageBps: 1500,
      adsCost: '500.00',
      openingAdsDebt: '175.00',
      employeeCommissionPercentageBps: 2500,
    });

    expect(result.bankCost).toBe('300.00');

    expect(
      result.resultBeforeCommission,
    ).toBe('1025.00');

    expect(result.employeeAmount).toBe(
      '256.25',
    );

    expect(result.adminProfit).toBe(
      '768.75',
    );

    expect(result.closingAdsDebt).toBe(
      '0.00',
    );
  });

  it('gera dívida quando há ADS sem faturamento', () => {
    const result = calculateDay({
      approvedRevenue: '0.00',
      bankFeePercentageBps: 1500,
      adsCost: '500.00',
      openingAdsDebt: '0.00',
      employeeCommissionPercentageBps: 2500,
    });

    expect(result.closingAdsDebt).toBe(
      '500.00',
    );

    expect(result.status).toBe('ADS_DEBT');
  });

  it('mantém dívida quando não existe movimento', () => {
    const result = calculateDay({
      approvedRevenue: '0.00',
      bankFeePercentageBps: 1500,
      adsCost: '0.00',
      openingAdsDebt: '300.00',
      employeeCommissionPercentageBps: 2500,
    });

    expect(result.closingAdsDebt).toBe(
      '300.00',
    );
  });

  it('aplica HALF_UP em meio centavo', () => {
    const result = calculateDay({
      approvedRevenue: '0.05',
      bankFeePercentageBps: 1000,
      adsCost: '0.00',
      openingAdsDebt: '0.00',
      employeeCommissionPercentageBps: 0,
    });

    // 0,05 × 10% = 0,005
    // HALF_UP => 0,01
    expect(result.bankCost).toBe('0.01');

    expect(
      result.resultBeforeCommission,
    ).toBe('0.04');
  });

  it('preserva todos os centavos entre employee e ADMIN', () => {
    const result = calculateDay({
      approvedRevenue: '5000.00',
      bankFeePercentageBps: 1500,
      adsCost: '523.33',
      openingAdsDebt: '0.00',
      employeeCommissionPercentageBps: 2500,
    });

    const employee = Number(
      result.employeeAmount,
    );

    const admin = Number(
      result.adminProfit,
    );

    expect(
      (employee + admin).toFixed(2),
    ).toBe(result.resultBeforeCommission);
  });

  it('rejeita BPS inválido', () => {
    expect(() =>
      validateBasisPoints(
        10001,
        'percentage',
      ),
    ).toThrow();

    expect(() =>
      validateBasisPoints(
        -1,
        'percentage',
      ),
    ).toThrow();

    expect(() =>
      validateBasisPoints(
        1500.5,
        'percentage',
      ),
    ).toThrow();
  });
});