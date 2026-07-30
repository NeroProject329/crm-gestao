export type ServiceId =
  | 'crm-web'
  | 'crm-api'
  | 'crm-worker';

export interface HealthResponse {
  status: 'ok';
  service: 'crm-api';
}
export type {
  AuthRole,
  AuthenticatedUserView,
  AuthSessionResponse,
} from './auth';