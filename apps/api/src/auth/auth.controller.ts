import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';

import {
  Throttle,
} from '@nestjs/throttler';

import type {
  CookieOptions,
  Request,
  Response,
} from 'express';

import {
  parseAuthEnv,
} from '@crm/config';

import type {
  AuthSessionResponse,
  AuthenticatedUserView,
} from '@crm/contracts';

import type {
  AuthContext,
} from './auth-context';

import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from './auth.constants';

import {
  AuthService,
} from './auth.service';

import {
  assertCsrf,
} from './csrf';

import {
  ChangePasswordDto,
} from './dto/change-password.dto';

import {
  LoginDto,
} from './dto/login.dto';

import {
  CurrentUser,
} from './decorators/current-user.decorator';

import {
  Public,
} from './decorators/public.decorator';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly auth:
      AuthService,
  ) {}

  /* =======================================================
     LOGIN
  ======================================================= */

  @Public()
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  @HttpCode(
    HttpStatus.OK,
  )
  @Post('login')
  async login(
    @Body()
    dto: LoginDto,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<AuthSessionResponse> {
    const bundle =
      await this.auth.login(
        dto,
      );

    this.setCookies(
      response,
      bundle,
    );

    return bundle.response;
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  @Public()
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @HttpCode(
    HttpStatus.OK,
  )
  @Post('refresh')
  async refresh(
    @Req()
    request: Request,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<AuthSessionResponse> {
    this.validatePublicCsrf(
      request,
    );

    const refreshToken =
      request.cookies?.[
        REFRESH_COOKIE
      ];

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const bundle =
      await this.auth.refresh(
        refreshToken,
      );

    this.setCookies(
      response,
      bundle,
    );

    return bundle.response;
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @Post('logout')
  async logout(
    @Req()
    request: Request,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<void> {
    this.validatePublicCsrf(
      request,
    );

    await this.auth.logout(
      request.cookies?.[
        REFRESH_COOKIE
      ],
    );

    this.clearCookies(
      response,
    );
  }

  /* =======================================================
     CURRENT USER
  ======================================================= */

  @Get('me')
  me(
    @CurrentUser()
    auth: AuthContext,
  ): Promise<AuthenticatedUserView> {
    return this.auth.currentUser(
      auth,
    );
  }

  /* =======================================================
     CHANGE PASSWORD
  ======================================================= */

  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @Post('change-password')
  async changePassword(
    @CurrentUser()
    auth: AuthContext,

    @Body()
    dto: ChangePasswordDto,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<void> {
    await this.auth
      .changePassword(
        auth,
        dto,
      );

    this.clearCookies(
      response,
    );
  }

  /* =======================================================
     COOKIE SETUP
  ======================================================= */

  private setCookies(
    response: Response,

    bundle: {
      accessToken: string;
      refreshToken: string;
      csrfToken: string;
    },
  ): void {
    const env =
      parseAuthEnv(
        process.env,
      );

    const secure =
      process.env.NODE_ENV ===
      'production';

    const shared:
      CookieOptions = {
        secure,

        sameSite:
          env.AUTH_COOKIE_SAME_SITE,
      };

    response.cookie(
      ACCESS_COOKIE,
      bundle.accessToken,
      {
        ...shared,

        httpOnly: true,

        path: '/',

        maxAge:
          env.JWT_ACCESS_TTL_SECONDS *
          1000,
      },
    );

    response.cookie(
      REFRESH_COOKIE,
      bundle.refreshToken,
      {
        ...shared,

        httpOnly: true,

        path:
          '/api/v1/auth',

        maxAge:
          env.AUTH_REFRESH_TTL_DAYS *
          24 *
          60 *
          60 *
          1000,
      },
    );

    response.cookie(
      CSRF_COOKIE,
      bundle.csrfToken,
      {
        ...shared,

        httpOnly: false,

        path: '/',

        maxAge:
          env.AUTH_REFRESH_TTL_DAYS *
          24 *
          60 *
          60 *
          1000,
      },
    );
  }

  /* =======================================================
     COOKIE CLEANUP
  ======================================================= */

  private clearCookies(
    response: Response,
  ): void {
    const env =
      parseAuthEnv(
        process.env,
      );

    const secure =
      process.env.NODE_ENV ===
      'production';

    response.clearCookie(
      ACCESS_COOKIE,
      {
        secure,

        sameSite:
          env.AUTH_COOKIE_SAME_SITE,

        path: '/',
      },
    );

    response.clearCookie(
      REFRESH_COOKIE,
      {
        secure,

        sameSite:
          env.AUTH_COOKIE_SAME_SITE,

        path:
          '/api/v1/auth',
      },
    );

    response.clearCookie(
      CSRF_COOKIE,
      {
        secure,

        sameSite:
          env.AUTH_COOKIE_SAME_SITE,

        path: '/',
      },
    );
  }

  /* =======================================================
     PUBLIC CSRF VALIDATION
  ======================================================= */

  private validatePublicCsrf(
    request: Request,
  ): void {
    assertCsrf(
      request.cookies?.[
        CSRF_COOKIE
      ],

      request.headers[
        'x-csrf-token'
      ],
    );
  }
}