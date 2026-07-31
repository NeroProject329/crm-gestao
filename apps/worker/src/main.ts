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
  NestFactory,
} from '@nestjs/core';

import {
  parseWorkerBootstrapEnv,
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
    existsSync(
      rootEnv,
    )
  ) {
    loadEnvFile(
      rootEnv,
    );
  }

  const env =
    parseWorkerBootstrapEnv(
      process.env,
    );

  const app =
    await NestFactory
      .createApplicationContext(
        AppModule,
      );

  app.enableShutdownHooks();

  console.log(
    `CRM Worker running [${env.APP_ENV}]`,
  );
}

void bootstrap()
  .catch(
    (
      error:
        unknown,
    ) => {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown bootstrap error';

      console.error(
        `CRM Worker failed to start: ${message}`,
      );

      process.exitCode = 1;
    },
  );