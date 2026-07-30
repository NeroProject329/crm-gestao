export type AuthRole =
  | 'ADMIN'
  | 'EMPLOYEE';

export interface AuthenticatedUserView {
  id: string;
  companyId: string;
  employeeId: string | null;

  name: string;
  email: string;

  role: AuthRole;
}

export interface AuthSessionResponse {
  user: AuthenticatedUserView;

  expiresInSeconds: number;
}