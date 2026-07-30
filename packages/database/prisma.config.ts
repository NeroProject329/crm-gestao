import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

const rootEnvPath = resolve(process.cwd(), '../../.env');

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },

  datasource: {
    // O fallback serve somente para comandos que não conectam ao banco,
    // como generate/build. Runtime/seed exigem DATABASE_URL real.
    url:
      process.env.DATABASE_URL ??
      'postgresql://unused:unused@localhost:5432/unused',
  },
});