import {
  SetMetadata,
} from '@nestjs/common';

import type {
  AuthRole,
} from '@crm/contracts';

import {
  AUTH_ROLES_KEY,
} from '../auth.constants';

export const Roles = (
  ...roles: AuthRole[]
) =>
  SetMetadata(
    AUTH_ROLES_KEY,
    roles,
  );