import {
  Module,
} from '@nestjs/common';

import {
  APP_GUARD,
  APP_INTERCEPTOR,
} from '@nestjs/core';

import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

import {
  AdsModule,
} from './ads/ads.module';

import {
  AppController,
} from './app.controller';

import {
  AppService,
} from './app.service';

import {
  AuthModule,
} from './auth/auth.module';

import {
  CsrfGuard,
} from './auth/csrf.guard';

import {
  JwtAuthGuard,
} from './auth/jwt-auth.guard';

import {
  RolesGuard,
} from './auth/roles.guard';

import {
  BankFeesModule,
} from './bank-fees/bank-fees.module';

import {
  CommissionsModule,
} from './commissions/commissions.module';

import {
  HttpLoggingInterceptor,
} from './common/http-logging.interceptor';

import {
  DashboardModule,
} from './dashboard/dashboard.module';

import {
  DatabaseModule,
} from './database/database.module';

import {
  EmployeesModule,
} from './employees/employees.module';

import {
  NotificationsModule,
} from './notifications/notifications.module';

import {
  RankingModule,
} from './ranking/ranking.module';

import {
  ReceiptsModule,
} from './receipts/receipts.module';

import {
  SettlementsModule,
} from './settlements/settlements.module';

import {
  UploadsModule,
} from './uploads/uploads.module';

@Module({
  imports: [
    DatabaseModule,

    AuthModule,
    NotificationsModule,

    EmployeesModule,
    BankFeesModule,
    CommissionsModule,

    AdsModule,

    UploadsModule,
    ReceiptsModule,

    DashboardModule,
    RankingModule,
    SettlementsModule,

    /*
     * Defesa geral.
     *
     * Endpoints sensíveis como login possuem
     * limites menores com @Throttle().
     */
    ThrottlerModule.forRoot([
      {
        name:
          'default',

        ttl:
          60_000,

        limit:
          120,
      },
    ]),
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,

    /* =====================================================
       RATE LIMIT
    ===================================================== */

    {
      provide:
        APP_GUARD,

      useClass:
        ThrottlerGuard,
    },

    /* =====================================================
       AUTHENTICATION
    ===================================================== */

    {
      provide:
        APP_GUARD,

      useClass:
        JwtAuthGuard,
    },

    /* =====================================================
       RBAC
    ===================================================== */

    {
      provide:
        APP_GUARD,

      useClass:
        RolesGuard,
    },

    /* =====================================================
       CSRF
    ===================================================== */

    {
      provide:
        APP_GUARD,

      useClass:
        CsrfGuard,
    },

    /* =====================================================
       STRUCTURED HTTP LOGGING
    ===================================================== */

    {
      provide:
        APP_INTERCEPTOR,

      useClass:
        HttpLoggingInterceptor,
    },
  ],
})
export class AppModule {}