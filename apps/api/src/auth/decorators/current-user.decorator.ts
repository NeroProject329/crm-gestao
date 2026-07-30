import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

import type {
  AuthContext,
} from '../auth-context';

export const CurrentUser =
  createParamDecorator(
    (
      _data: unknown,
      context: ExecutionContext,
    ): AuthContext => {
      const request =
        context
          .switchToHttp()
          .getRequest<{
            auth: AuthContext;
          }>();

      return request.auth;
    },
  );