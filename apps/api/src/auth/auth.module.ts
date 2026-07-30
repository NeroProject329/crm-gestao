import {
  Module,
} from '@nestjs/common';

import {
  JwtModule,
} from '@nestjs/jwt';

import {
  AuthController,
} from './auth.controller';

import {
  AuthService,
} from './auth.service';

import {
  CsrfGuard,
} from './csrf.guard';

import {
  JwtAuthGuard,
} from './jwt-auth.guard';

import {
  RolesGuard,
} from './roles.guard';

@Module({
  imports: [
    JwtModule.register({
      global: true,
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    CsrfGuard,
  ],

  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}