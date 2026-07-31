export type DashboardPreset =
  | 'TODAY'
  | 'WEEK'
  | 'MONTH'
  | 'YEAR'
  | 'CUSTOM';

export type EmployeeDashboardPreset =
  DashboardPreset;

export type EmployeeFinancialStatus =
  | 'POSITIVE'
  | 'ADS_DEBT'
  | 'ZERO';

/* =========================================================
   SHARED PERIOD
========================================================= */

export interface EmployeeDashboardPeriodView {
  preset:
    DashboardPreset;

  from: string;
  to: string;
}

/* =========================================================
   EMPLOYEE
========================================================= */

export interface EmployeeDashboardProfileView {
  employeeId: string;

  name: string;
  email: string;
}

export interface EmployeeFinancialSummaryView {
  approvedRevenue:
    string;

  bankCost:
    string;

  adsCost:
    string;

  employeeAmount:
    string;

  openingAdsDebt:
    string;

  closingAdsDebt:
    string;

  status:
    EmployeeFinancialStatus;
}

export interface EmployeeFinancialDayView {
  businessDate:
    string;

  approvedRevenue:
    string;

  bankCost:
    string;

  adsCost:
    string;

  employeeAmount:
    string;

  openingAdsDebt:
    string;

  closingAdsDebt:
    string;

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

/* =========================================================
   ADMIN
========================================================= */

export interface AdminFinancialSummaryView {
  approvedRevenue:
    string;

  bankCost:
    string;

  adsCost:
    string;

  employeeAmount:
    string;

  adminProfit:
    string;

  currentAdsDebt:
    string;

  totalEmployees:
    number;

  activeEmployees:
    number;

  pendingReceipts:
    number;
}

export interface AdminFinancialDayView {
  businessDate:
    string;

  approvedRevenue:
    string;

  bankCost:
    string;

  adsCost:
    string;

  employeeAmount:
    string;

  adminProfit:
    string;
}

export interface AdminEmployeeFinancialView {
  employeeId:
    string;

  name:
    string;

  email:
    string;

  active:
    boolean;

  approvedRevenue:
    string;

  bankCost:
    string;

  adsCost:
    string;

  employeeAmount:
    string;

  adminProfit:
    string;

  currentAdsDebt:
    string;

  status:
    EmployeeFinancialStatus;
}

export interface AdminRankingItemView {
  position:
    number;

  employeeId:
    string;

  name:
    string;

  email:
    string;

  active:
    boolean;

  approvedRevenue:
    string;

  employeeAmount:
    string;

  adminProfit:
    string;

  currentAdsDebt:
    string;

  status:
    EmployeeFinancialStatus;
}

export interface AdminDashboardView {
  period:
    EmployeeDashboardPeriodView;

  summary:
    AdminFinancialSummaryView;

  days:
    AdminFinancialDayView[];

  employees:
    AdminEmployeeFinancialView[];

  ranking:
    AdminRankingItemView[];
}

export interface AdminRankingView {
  period:
    EmployeeDashboardPeriodView;

  items:
    AdminRankingItemView[];
}