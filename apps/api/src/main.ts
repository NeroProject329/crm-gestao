import { parseApiBootstrapEnv } from '@crm/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const env = parseApiBootstrapEnv(process.env);

  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');

  console.log(`CRM API running on port ${env.PORT} [${env.APP_ENV}]`);
}

void bootstrap();
