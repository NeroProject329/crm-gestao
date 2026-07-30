import {
  Module,
} from '@nestjs/common';

import {
  APP_GUARD,
} from '@nestjs/core';

import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

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
  DatabaseModule,
} from './database/database.module';

@Module({
  imports: [
    DatabaseModule,

    AuthModule,

    ThrottlerModule.forRoot([
      {
        name: 'default',

        ttl: 60_000,

        limit: 120,
      },
    ]),
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,

    {
      provide:
        APP_GUARD,

      useClass:
        ThrottlerGuard,
    },

    {
      provide:
        APP_GUARD,

      useClass:
        JwtAuthGuard,
    },

    {
      provide:
        APP_GUARD,

      useClass:
        RolesGuard,
    },

    {
      provide:
        APP_GUARD,

      useClass:
        CsrfGuard,
    },
  ],
})
export class AppModule {}