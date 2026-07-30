import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { argon2id, hash } from 'argon2';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  CompanyStatus,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/enums';

const rootEnvPath = resolve(process.cwd(), '../../.env');

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parseWeekStartDay(value: string | undefined): number {
  const parsed = Number(value ?? '1');

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
    throw new Error('SEED_WEEK_START_DAY must be an integer between 0 and 6.');
  }

  return parsed;
}

function parseBps(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new Error('SEED_BANK_FEE_BPS must be an integer between 0 and 10000.');
  }

  return parsed;
}

async function main(): Promise<void> {
  const databaseUrl = requiredEnv('DATABASE_URL');

  const companyName =
    process.env.SEED_COMPANY_NAME?.trim() ||
    'CRM Gestao Comercial e Contabilidade';

  const companySlug =
    process.env.SEED_COMPANY_SLUG?.trim() || 'crm-gestao';

  const adminName =
    process.env.SEED_ADMIN_NAME?.trim() || 'Administrador';

  const adminEmail = requiredEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const adminPassword = requiredEnv('SEED_ADMIN_PASSWORD');

  if (adminPassword.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must contain at least 12 characters.');
  }

  const timezone =
    process.env.APP_TIMEZONE?.trim() || 'America/Sao_Paulo';

  const weekStartDay = parseWeekStartDay(
    process.env.SEED_WEEK_START_DAY,
  );

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    const company = await prisma.company.upsert({
      where: {
        slug: companySlug,
      },
      update: {
        name: companyName,
        status: CompanyStatus.ACTIVE,
      },
      create: {
        name: companyName,
        slug: companySlug,
        status: CompanyStatus.ACTIVE,
      },
    });

    await prisma.companySettings.upsert({
      where: {
        companyId: company.id,
      },
      update: {
        timezone,
        weekStartDay,
      },
      create: {
        companyId: company.id,
        timezone,
        weekStartDay,
      },
    });

    const passwordHash = await hash(adminPassword, {
      type: argon2id,
    });

    const admin = await prisma.user.upsert({
      where: {
        companyId_email: {
          companyId: company.id,
          email: adminEmail,
        },
      },
      update: {
        name: adminName,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
      create: {
        companyId: company.id,
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const bankFeeBpsRaw =
      process.env.SEED_BANK_FEE_BPS?.trim();

    const bankFeeEffectiveFromRaw =
      process.env.SEED_BANK_FEE_EFFECTIVE_FROM?.trim();

    if (
      Boolean(bankFeeBpsRaw) !==
      Boolean(bankFeeEffectiveFromRaw)
    ) {
      throw new Error(
        'SEED_BANK_FEE_BPS and SEED_BANK_FEE_EFFECTIVE_FROM must be configured together.',
      );
    }

    if (bankFeeBpsRaw && bankFeeEffectiveFromRaw) {
      const percentageBps = parseBps(bankFeeBpsRaw);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(bankFeeEffectiveFromRaw)) {
        throw new Error(
          'SEED_BANK_FEE_EFFECTIVE_FROM must use YYYY-MM-DD.',
        );
      }

      const effectiveFrom = new Date(
        `${bankFeeEffectiveFromRaw}T00:00:00.000Z`,
      );

      const existingPolicy =
        await prisma.bankFeePolicy.findFirst({
          where: {
            companyId: company.id,
            effectiveFrom,
          },
        });

      if (existingPolicy) {
        await prisma.bankFeePolicy.update({
          where: {
            id: existingPolicy.id,
          },
          data: {
            percentageBps,
          },
        });
      } else {
        await prisma.bankFeePolicy.create({
          data: {
            companyId: company.id,
            percentageBps,
            effectiveFrom,
          },
        });
      }
    }

    console.log('Database seed completed.');
    console.log(`Company: ${company.slug}`);
    console.log(`ADMIN: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Database seed failed.');
  console.error(error);
  process.exit(1);
});