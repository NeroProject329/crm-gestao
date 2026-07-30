import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import type {
  AuthContext,
} from '../auth-context';

export const CurrentEmployeeId =
  createParamDecorator(
    (
      _data: unknown,
      context: ExecutionContext,
    ): string => {
      const request =
        context
          .switchToHttp()
          .getRequest<{
            auth: AuthContext;
          }>();

      const auth = request.auth;

      if (
        auth.role !== 'EMPLOYEE' ||
        !auth.employeeId
      ) {
        throw new ForbiddenException(
          'Employee context required.',
        );
      }

      return auth.employeeId;
    },
  );