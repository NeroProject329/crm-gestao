import Decimal from 'decimal.js';

import {
  bpsMultiplier,
  validateBasisPoints,
} from './bps';

import {
  moneyString,
  nonNegativeMoney,
  roundMoney,
  ZERO_MONEY,
} from './money';

import type {
  CalculateDayInput,
  DailyFinancialResult,
} from './types';

export function calculateDay(
  input: CalculateDayInput,
): DailyFinancialResult {
  const approvedRevenue = nonNegativeMoney(
    input.approvedRevenue,
    'approvedRevenue',
  );

  const adsCost = nonNegativeMoney(
    input.adsCost,
    'adsCost',
  );

  const openingAdsDebt = nonNegativeMoney(
    input.openingAdsDebt,
    'openingAdsDebt',
  );

  const bankFeePercentageBps = validateBasisPoints(
    input.bankFeePercentageBps,
    'bankFeePercentageBps',
  );

  const employeeCommissionPercentageBps =
    validateBasisPoints(
      input.employeeCommissionPercentageBps,
      'employeeCommissionPercentageBps',
    );

  const bankCost = roundMoney(
    approvedRevenue.mul(
      bpsMultiplier(bankFeePercentageBps),
    ),
  );

  const revenueAfterBank = roundMoney(
    approvedRevenue.minus(bankCost),
  );

  const resultBeforeCommission = roundMoney(
    revenueAfterBank
      .minus(adsCost)
      .minus(openingAdsDebt),
  );

  let employeeAmount = new Decimal(0);
  let adminProfit = new Decimal(0);
  let closingAdsDebt = new Decimal(0);

  let status: DailyFinancialResult['status'];

  if (resultBeforeCommission.isPositive()) {
    employeeAmount = roundMoney(
      resultBeforeCommission.mul(
        bpsMultiplier(
          employeeCommissionPercentageBps,
        ),
      ),
    );

    // Importante:
    // ADMIN recebe o restante, não uma nova porcentagem.
    // Isso preserva todos os centavos.
    adminProfit = roundMoney(
      resultBeforeCommission.minus(employeeAmount),
    );

    status = 'POSITIVE';
  } else if (resultBeforeCommission.isNegative()) {
    closingAdsDebt = roundMoney(
      resultBeforeCommission.abs(),
    );

    status = 'ADS_DEBT';
  } else {
    status = 'ZERO';
  }

  if (
    status === 'POSITIVE' &&
    !employeeAmount
      .plus(adminProfit)
      .equals(resultBeforeCommission)
  ) {
    throw new Error(
      'Financial invariant violated: employeeAmount + adminProfit must equal resultBeforeCommission.',
    );
  }

  return {
    approvedRevenue: moneyString(approvedRevenue),

    bankFeePercentageBps,
    bankCost: moneyString(bankCost),
    revenueAfterBank: moneyString(revenueAfterBank),

    adsCost: moneyString(adsCost),
    openingAdsDebt: moneyString(openingAdsDebt),

    resultBeforeCommission: moneyString(
      resultBeforeCommission,
    ),

    employeeCommissionPercentageBps,

    employeeAmount:
      status === 'POSITIVE'
        ? moneyString(employeeAmount)
        : ZERO_MONEY,

    adminProfit:
      status === 'POSITIVE'
        ? moneyString(adminProfit)
        : ZERO_MONEY,

    closingAdsDebt:
      status === 'ADS_DEBT'
        ? moneyString(closingAdsDebt)
        : ZERO_MONEY,

    status,
  };
}