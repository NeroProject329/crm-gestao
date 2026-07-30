import Decimal from 'decimal.js';

export const ZERO_MONEY = '0.00';

export function decimal(
  value: Decimal.Value,
  field = 'value',
): Decimal {
  let result: Decimal;

  try {
    result = new Decimal(value);
  } catch {
    throw new Error(`${field} must be a valid decimal value.`);
  }

  if (!result.isFinite()) {
    throw new Error(`${field} must be finite.`);
  }

  return result;
}

export function roundMoney(
  value: Decimal.Value,
): Decimal {
  return decimal(value).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
}

export function moneyString(
  value: Decimal.Value,
): string {
  return roundMoney(value).toFixed(2);
}

export function nonNegativeMoney(
  value: Decimal.Value,
  field: string,
): Decimal {
  const result = roundMoney(value);

  if (result.isNegative()) {
    throw new Error(`${field} cannot be negative.`);
  }

  return result;
}