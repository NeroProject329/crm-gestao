import {
  existsSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  loadEnvFile,
} from 'node:process';

import {
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import type {
  NestExpressApplication,
} from '@nestjs/platform-express';

import cookieParser
  from 'cookie-parser';

import helmet
  from 'helmet';

import {
  parseApiBootstrapEnv,
  parseAuthEnv,
  parseInfrastructureEnv,
} from '@crm/config';

import {
  AppModule,
} from './app.module';

import {
  requestIdMiddleware,
} from './common/request-id.middleware';

async function bootstrap():
  Promise<void> {
  const rootEnv =
    resolve(
      process.cwd(),
      '../../.env',
    );

  if (
    existsSync(
      rootEnv,
    )
  ) {
    loadEnvFile(
      rootEnv,
    );
  }

  /*
   * Toda configuração crítica é validada
   * antes do servidor começar a aceitar
   * conexões.
   */
  const env =
    parseApiBootstrapEnv(
      process.env,
    );

  const authEnv =
    parseAuthEnv(
      process.env,
    );

  parseInfrastructureEnv(
    process.env,
  );

  const app =
    await NestFactory
      .create<
        NestExpressApplication
      >(
        AppModule,
      );

  /* =======================================================
     PROCESS / PROXY
  ======================================================= */

  app.enableShutdownHooks();

  /*
   * Railway atua como reverse proxy.
   *
   * Necessário para IP/protocolo corretamente
   * interpretados por Express e throttling.
   */
  app.set(
    'trust proxy',
    1,
  );

  /*
   * Express normalmente expõe:
   *
   * X-Powered-By: Express
   *
   * Não há benefício em divulgar isso.
   */
  app.disable(
    'x-powered-by',
  );

  /* =======================================================
     SECURITY HEADERS

     Helmet deve entrar cedo no pipeline.
  ======================================================= */

  app.use(
    helmet(),
  );

  /* =======================================================
     REQUEST CORRELATION
  ======================================================= */

  app.use(
    requestIdMiddleware,
  );

  /* =======================================================
     COOKIES
  ======================================================= */

  app.use(
    cookieParser(),
  );

  /* =======================================================
     DTO VALIDATION
  ======================================================= */

  app.useGlobalPipes(
    new ValidationPipe({
      /*
       * Campos que não pertencem ao DTO
       * são removidos.
       */
      whitelist:
        true,

      /*
       * E neste projeto preferimos rejeitar
       * explicitamente payload inesperado.
       */
      forbidNonWhitelisted:
        true,

      transform:
        true,
    }),
  );

  /* =======================================================
     CORS
  ======================================================= */

  if (
    authEnv.WEB_ORIGIN
  ) {
    app.enableCors({
      /*
       * Sem wildcard.
       */
      origin:
        authEnv
          .WEB_ORIGIN,

      credentials:
        true,

      methods: [
        'GET',
        'HEAD',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],

      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'X-Request-Id',
      ],

      exposedHeaders: [
        'X-Request-Id',
      ],

      maxAge:
        600,
    });
  }

  /* =======================================================
     LISTEN
  ======================================================= */

  await app.listen(
    env.PORT,
    '0.0.0.0',
  );

  console.log(
    JSON.stringify({
      event:
        'api.ready',

      service:
        'crm-api',

      port:
        env.PORT,

      environment:
        env.APP_ENV,
    }),
  );
}

void bootstrap();