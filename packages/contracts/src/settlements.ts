export type WeeklySettlementStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'REVIEW_REQUIRED'
  | 'PAID';

/* =========================================================
   EMPLOYEE PROFILE
========================================================= */

export interface SettlementEmployeeView {
  employeeId: string;

  name: string;
  email: string;
}

/* =========================================================
   EMPLOYEE SAFE VIEW

   IMPORTANTE:
   adminProfit NÃO existe aqui.
========================================================= */

export interface EmployeeWeeklySettlementView {
  id: string;

  periodStart: string;
  periodEnd: string;

  status:
    WeeklySettlementStatus;

  approvedRevenue: string;

  bankCost: string;

  adsCost: string;

  employeeAmount: string;

  openingAdsDebt: string;
  closingAdsDebt: string;

  closedAt:
    | string
    | null;

  paidAt:
    | string
    | null;

  createdAt: string;
  updatedAt: string;
}

/* =========================================================
   ADMIN VIEW
========================================================= */

export interface AdminWeeklySettlementView {
  id: string;

  employee:
    SettlementEmployeeView;

  periodStart: string;
  periodEnd: string;

  status:
    WeeklySettlementStatus;

  approvedRevenue: string;

  bankCost: string;

  adsCost: string;

  employeeAmount: string;

  adminProfit: string;

  openingAdsDebt: string;
  closingAdsDebt: string;

  closedByUserId:
    | string
    | null;

  closedAt:
    | string
    | null;

  paidByUserId:
    | string
    | null;

  paidAt:
    | string
    | null;

  createdAt: string;
  updatedAt: string;
}

/* =========================================================
   CURRENT WEEK
========================================================= */

export interface AdminCurrentWeekView {
  periodStart: string;
  periodEnd: string;

  settlements:
    AdminWeeklySettlementView[];
}

export type FinancialAdjustmentViewType =
  | 'CREDIT'
  | 'DEBIT';

export interface FinancialAdjustmentView {
  id: string;

  settlementId: string;

  type:
    FinancialAdjustmentViewType;

  amount: string;

  reason: string;

  originType: string;

  originId:
    | string
    | null;

  createdAt: string;
}