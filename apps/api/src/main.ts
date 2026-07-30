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

import cookieParser from 'cookie-parser';

import {
  parseApiBootstrapEnv,
  parseAuthEnv,
  parseInfrastructureEnv,
} from '@crm/config';

import {
  AppModule,
} from './app.module';

async function bootstrap():
  Promise<void> {
  const rootEnv =
    resolve(
      process.cwd(),
      '../../.env',
    );

  if (
    existsSync(rootEnv)
  ) {
    loadEnvFile(rootEnv);
  }

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
      .create<NestExpressApplication>(
        AppModule,
      );

  app.enableShutdownHooks();

  app.set(
    'trust proxy',
    1,
  );

  app.use(
    cookieParser(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted:
        true,

      transform: true,
    }),
  );

  if (
    authEnv.WEB_ORIGIN
  ) {
    app.enableCors({
      origin:
        authEnv.WEB_ORIGIN,

      credentials:
        true,
    });
  }

  await app.listen(
    env.PORT,
    '0.0.0.0',
  );

  console.log(
    `CRM API running on port ${env.PORT} [${env.APP_ENV}]`,
  );
}

void bootstrap();