import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import {
  createPrismaClient,
  type PrismaClient,
} from '@crm/database';

import {
  WorkerConfigService,
} from './worker-config.service';

@Injectable()
export class DatabaseService
  implements
    OnModuleInit,
    OnModuleDestroy
{
  readonly prisma:
    PrismaClient;

  constructor(
    config:
      WorkerConfigService,
  ) {
    this.prisma =
      createPrismaClient(
        config.databaseUrl,
      );
  }

  async onModuleInit():
    Promise<void> {
    await this.prisma
      .$connect();
  }

  async onModuleDestroy():
    Promise<void> {
    await this.prisma
      .$disconnect();
  }
}