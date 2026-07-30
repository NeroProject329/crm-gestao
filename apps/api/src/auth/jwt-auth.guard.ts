import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  JwtService,
} from '@nestjs/jwt';

import type {
  Request,
} from 'express';

import {
  CompanyStatus,
  UserStatus,
} from '@crm/database';

import {
  parseAuthEnv,
} from '@crm/config';

import {
  DatabaseService,
} from '../database/database.service';

import type {
  AuthContext,
  AuthSource,
} from './auth-context';

import {
  ACCESS_COOKIE,
  PUBLIC_ROUTE_KEY,
} from './auth.constants';

interface JwtPayload {
  sub: string;
  sid: string;
  companyId: string;
}

interface AuthRequest extends Request {
  auth?: AuthContext;
}

@Injectable()
export class JwtAuthGuard
  implements CanActivate
{
  constructor(
    private readonly jwt:
      JwtService,

    private readonly reflector:
      Reflector,

    private readonly database:
      DatabaseService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
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

    const extracted =
      this.extractToken(
        request,
      );

    if (!extracted) {
      throw new UnauthorizedException();
    }

    const env =
      parseAuthEnv(
        process.env,
      );

    let payload: JwtPayload;

    try {
      payload =
        await this.jwt.verifyAsync<JwtPayload>(
          extracted.token,
          {
            secret:
              env.JWT_ACCESS_SECRET,
          },
        );
    } catch {
      throw new UnauthorizedException();
    }

    if (
      !payload.sub ||
      !payload.sid ||
      !payload.companyId
    ) {
      throw new UnauthorizedException();
    }

    const session =
      await this.database.prisma
        .refreshSession.findFirst({
          where: {
            id: payload.sid,
            userId: payload.sub,
            revokedAt: null,

            expiresAt: {
              gt: new Date(),
            },
          },

          include: {
            user: {
              include: {
                employee: true,
                company: true,
              },
            },
          },
        });

    if (
      !session ||
      session.user.status !==
        UserStatus.ACTIVE ||
      session.user.company.status !==
        CompanyStatus.ACTIVE ||
      session.user.companyId !==
        payload.companyId
    ) {
      throw new UnauthorizedException();
    }

    if (
      session.user.role ===
        'EMPLOYEE' &&
      (
        !session.user.employee ||
        !session.user.employee.active
      )
    ) {
      throw new UnauthorizedException();
    }

    request.auth = {
      userId:
        session.user.id,

      companyId:
        session.user.companyId,

      employeeId:
        session.user.employee?.id ??
        null,

      role:
        session.user.role,

      sessionId:
        session.id,

      source:
        extracted.source,
    };

    return true;
  }

  private extractToken(
    request: AuthRequest,
  ):
    | {
        token: string;
        source: AuthSource;
      }
    | undefined {
    const authorization =
      request.headers.authorization;

    if (
      authorization?.startsWith(
        'Bearer ',
      )
    ) {
      return {
        token:
          authorization.slice(7),
        source: 'bearer',
      };
    }

    const cookieToken =
      request.cookies?.[
        ACCESS_COOKIE
      ];

    if (
      typeof cookieToken ===
        'string' &&
      cookieToken.length > 0
    ) {
      return {
        token: cookieToken,
        source: 'cookie',
      };
    }

    return undefined;
  }
}