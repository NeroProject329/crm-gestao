import Decimal from 'decimal.js';

import type { BasisPoints } from './types';

export const BPS_DIVISOR = 10_000;

export function validateBasisPoints(
  value: number,
  field: string,
): BasisPoints {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be an integer.`);
  }

  if (value < 0 || value > BPS_DIVISOR) {
    throw new Error(
      `${field} must be between 0 and 10000 basis points.`,
    );
  }

  return value;
}

export function bpsMultiplier(
  value: BasisPoints,
): Decimal {
  validateBasisPoints(value, 'percentageBps');

  return new Decimal(value).div(BPS_DIVISOR);
}