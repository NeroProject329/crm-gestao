import type {
  AuthRole,
} from '@crm/contracts';

export type AuthSource =
  | 'bearer'
  | 'cookie';

export interface AuthContext {
  userId: string;
  companyId: string;
  employeeId: string | null;

  role: AuthRole;

  sessionId: string;

  source: AuthSource;
}