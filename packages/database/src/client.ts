import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export function createPrismaClient(databaseUrl: string): PrismaClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create PrismaClient.');
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  return new PrismaClient({
    adapter,
  });
}