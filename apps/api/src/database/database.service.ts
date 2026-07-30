import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  createPrismaClient,
  PrismaClient,
} from '@crm/database';

import {
  parseInfrastructureEnv,
} from '@crm/config';

@Injectable()
export class DatabaseService
  implements OnModuleDestroy
{
  readonly prisma: PrismaClient;

  constructor() {
    const env = parseInfrastructureEnv(
      process.env,
    );

    this.prisma = createPrismaClient(
      env.DATABASE_URL,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}