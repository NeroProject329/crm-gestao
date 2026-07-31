export type EmployeeDashboardPreset =
  | 'TODAY'
  | 'WEEK'
  | 'MONTH'
  | 'YEAR'
  | 'CUSTOM';

export type EmployeeFinancialStatus =
  | 'POSITIVE'
  | 'ADS_DEBT'
  | 'ZERO';

export interface EmployeeDashboardPeriodView {
  preset: EmployeeDashboardPreset;

  from: string;
  to: string;
}

export interface EmployeeDashboardProfileView {
  employeeId: string;

  name: string;
  email: string;
}

export interface EmployeeFinancialSummaryView {
  approvedRevenue: string;

  bankCost: string;

  adsCost: string;

  employeeAmount: string;

  openingAdsDebt: string;

  closingAdsDebt: string;

  status:
    EmployeeFinancialStatus;
}

export interface EmployeeFinancialDayView {
  businessDate: string;

  approvedRevenue: string;

  bankCost: string;

  adsCost: string;

  employeeAmount: string;

  openingAdsDebt: string;

  closingAdsDebt: string;

  status:
    EmployeeFinancialStatus;
}

export interface EmployeeDashboardView {
  employee:
    EmployeeDashboardProfileView;

  period:
    EmployeeDashboardPeriodView;

  summary:
    EmployeeFinancialSummaryView;

  days:
    EmployeeFinancialDayView[];
}