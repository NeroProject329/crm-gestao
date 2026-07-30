export type MoneyString = string;
export type BusinessDate = string;
export type BasisPoints = number;

export type DailyFinancialStatus =
  | 'POSITIVE'
  | 'ADS_DEBT'
  | 'ZERO';

export interface CalculateDayInput {
  approvedRevenue: MoneyString;

  bankFeePercentageBps: BasisPoints;

  adsCost: MoneyString;
  openingAdsDebt: MoneyString;

  employeeCommissionPercentageBps: BasisPoints;
}

export interface DailyFinancialResult {
  approvedRevenue: MoneyString;

  bankFeePercentageBps: BasisPoints;
  bankCost: MoneyString;
  revenueAfterBank: MoneyString;

  adsCost: MoneyString;
  openingAdsDebt: MoneyString;

  resultBeforeCommission: MoneyString;

  employeeCommissionPercentageBps: BasisPoints;
  employeeAmount: MoneyString;
  adminProfit: MoneyString;

  closingAdsDebt: MoneyString;

  status: DailyFinancialStatus;
}

export interface RecalculationDayInput {
  approvedRevenue: MoneyString;
  bankFeePercentageBps: BasisPoints;
  adsCost: MoneyString;
  employeeCommissionPercentageBps: BasisPoints;
}

export interface RecalculationSummary {
  employeeId: string;
  startDate: BusinessDate;
  endDate: BusinessDate;
  processedDays: number;
  closingAdsDebt: MoneyString;
}