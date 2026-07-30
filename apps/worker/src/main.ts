import { parseWorkerBootstrapEnv } from '@crm/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap(): Promise<void> {
  parseWorkerBootstrapEnv(process.env);

  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();

  const appService = app.get(AppService);

  appService.start();
}

void bootstrap();
