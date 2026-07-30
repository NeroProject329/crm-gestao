import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import type {
  Request,
} from 'express';

import type {
  AuthContext,
} from './auth-context';

import {
  CSRF_COOKIE,
  PUBLIC_ROUTE_KEY,
} from './auth.constants';

import {
  assertCsrf,
} from './csrf';

interface AuthRequest extends Request {
  auth?: AuthContext;
}

@Injectable()
export class CsrfGuard
  implements CanActivate
{
  constructor(
    private readonly reflector:
      Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(
        PUBLIC_ROUTE_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (isPublic) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<AuthRequest>();

    if (
      ['GET', 'HEAD', 'OPTIONS']
        .includes(request.method)
    ) {
      return true;
    }

    if (
      request.auth?.source !==
      'cookie'
    ) {
      return true;
    }

    assertCsrf(
      request.cookies?.[
        CSRF_COOKIE
      ],

      request.headers[
        'x-csrf-token'
      ],
    );

    return true;
  }
}