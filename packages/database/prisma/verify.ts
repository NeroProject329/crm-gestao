import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { UserRole } from '../src/generated/prisma/enums';

const rootEnvPath = resolve(process.cwd(), '../../.env');

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

const expectedTables = [
  'companies',
  'company_settings',
  'users',
  'employees',
  'refresh_sessions',
  'password_reset_tokens',
  'bank_fee_policies',
  'employee_commission_policies',
  'ads_entries',
  'payment_receipts',
  'receipt_files',
  'daily_financial_results',
  'weekly_settlements',
  'financial_adjustments',
  'notifications',
  'notification_recipients',
  'push_deliveries',
  'audit_logs',
  'outbox_events',
] as const;

const expectedConstraints = [
  'company_settings_week_start_day_check',
  'bank_fee_policies_percentage_bps_check',
  'bank_fee_policies_dates_check',
  'bank_fee_policies_no_overlap',
  'employee_commission_policies_percentage_bps_check',
  'employee_commission_policies_dates_check',
  'employee_commission_policies_no_overlap',
  'ads_entries_amount_positive',
  'payment_receipts_amount_positive',
  'weekly_settlements_period_check',
] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    const tables = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `;

    const foundTables = new Set(
      tables.map((table) => table.table_name),
    );

    const missingTables = expectedTables.filter(
      (table) => !foundTables.has(table),
    );

    if (missingTables.length > 0) {
      throw new Error(
        `Missing tables: ${missingTables.join(', ')}`,
      );
    }

    const constraints = await prisma.$queryRaw<
      Array<{ conname: string }>
    >`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'company_settings_week_start_day_check',
        'bank_fee_policies_percentage_bps_check',
        'bank_fee_policies_dates_check',
        'bank_fee_policies_no_overlap',
        'employee_commission_policies_percentage_bps_check',
        'employee_commission_policies_dates_check',
        'employee_commission_policies_no_overlap',
        'ads_entries_amount_positive',
        'payment_receipts_amount_positive',
        'weekly_settlements_period_check'
      )
    `;

    const foundConstraints = new Set(
      constraints.map((constraint) => constraint.conname),
    );

    const missingConstraints = expectedConstraints.filter(
      (constraint) => !foundConstraints.has(constraint),
    );

    if (missingConstraints.length > 0) {
      throw new Error(
        `Missing constraints: ${missingConstraints.join(', ')}`,
      );
    }

    const companySlug =
      process.env.SEED_COMPANY_SLUG?.trim() || 'crm-gestao';

    const company = await prisma.company.findUnique({
      where: {
        slug: companySlug,
      },
      include: {
        settings: true,
        users: {
          where: {
            role: UserRole.ADMIN,
          },
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!company) {
      throw new Error('Seed Company was not found.');
    }

    if (!company.settings) {
      throw new Error('CompanySettings was not found.');
    }

    if (company.users.length === 0) {
      throw new Error('Seed ADMIN was not found.');
    }

    console.log('Database V1 verification: OK');
    console.log(`Tables: ${expectedTables.length}/${expectedTables.length}`);
    console.log('Company: OK');
    console.log('CompanySettings: OK');
    console.log('ADMIN: OK');
    console.log('Constraints: OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Database V1 verification: FAILED');
  console.error(error);
  process.exit(1);
});