export type AdminUserStatus =
  | 'ACTIVE'
  | 'INACTIVE';

export interface AdminEmployeeView {
  employeeId: string;
  userId: string;

  name: string;
  email: string;

  userStatus: AdminUserStatus;
  active: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface BankFeePolicyView {
  id: string;

  percentageBps: number;

  effectiveFrom: string;
  effectiveUntil: string | null;

  createdAt: string;
}

export interface EmployeeCommissionPolicyView {
  id: string;
  employeeId: string;

  percentageBps: number;

  effectiveFrom: string;
  effectiveUntil: string | null;

  createdAt: string;
}