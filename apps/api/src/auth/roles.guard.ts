import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import type {
  AuthRole,
} from '@crm/contracts';

import type {
  AuthContext,
} from './auth-context';

import {
  AUTH_ROLES_KEY,
} from './auth.constants';

@Injectable()
export class RolesGuard
  implements CanActivate
{
  constructor(
    private readonly reflector:
      Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const roles =
      this.reflector
        .getAllAndOverride<AuthRole[]>(
          AUTH_ROLES_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    if (
      !roles ||
      roles.length === 0
    ) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<{
          auth: AuthContext;
        }>();

    if (
      !roles.includes(
        request.auth.role,
      )
    ) {
      throw new ForbiddenException();
    }

    return true;
  }
}