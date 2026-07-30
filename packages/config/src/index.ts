import * as z from 'zod';

const timezoneSchema = z.string().min(1).refine(
  (timezone) => {
    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
      });

      return true;
    } catch {
      return false;
    }
  },
  {
    message: 'Invalid IANA timezone',
  },
);

const postgresUrlSchema = z
  .string()
  .min(1)
  .regex(
    /^postgres(?:ql)?:\/\//,
    'DATABASE_URL must start with postgres:// or postgresql://',
  );

const redisUrlSchema = z
  .string()
  .min(1)
  .regex(
    /^rediss?:\/\//,
    'REDIS_URL must start with redis:// or rediss://',
  );

export const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  APP_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),

  APP_TIMEZONE: timezoneSchema.default('UTC'),
});

export const apiBootstrapEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export const workerBootstrapEnvSchema = baseEnvSchema;

export const infrastructureEnvSchema = z.object({
  DATABASE_URL: postgresUrlSchema,
  REDIS_URL: redisUrlSchema,
});

export const authEnvSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32),

  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(86400)
    .default(900),

  AUTH_REFRESH_TTL_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .default(30),

  AUTH_COOKIE_SAME_SITE: z
    .enum(['strict', 'lax', 'none'])
    .default('lax'),

  WEB_ORIGIN: z.url().optional(),
});

export const r2EnvSchema = z.object({
  R2_ENDPOINT: z.url(),
  R2_REGION: z.literal('auto').default('auto'),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

export const pushcutEnvSchema = z.object({
  PUSHCUT_BASE_URL: z.url().default('https://api.pushcut.io/v1'),
  PUSHCUT_API_KEY: z.string().min(1),
});

export const webEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

export type ApiBootstrapEnv =
  z.infer<typeof apiBootstrapEnvSchema>;

export type WorkerBootstrapEnv =
  z.infer<typeof workerBootstrapEnvSchema>;

export type InfrastructureEnv =
  z.infer<typeof infrastructureEnvSchema>;

export type AuthEnv =
  z.infer<typeof authEnvSchema>;

export type R2Env =
  z.infer<typeof r2EnvSchema>;

export type PushcutEnv =
  z.infer<typeof pushcutEnvSchema>;

export type WebEnv =
  z.infer<typeof webEnvSchema>;

export function parseApiBootstrapEnv(
  env: Record<string, string | undefined>,
): ApiBootstrapEnv {
  return apiBootstrapEnvSchema.parse(env);
}

export function parseWorkerBootstrapEnv(
  env: Record<string, string | undefined>,
): WorkerBootstrapEnv {
  return workerBootstrapEnvSchema.parse(env);
}

export function parseInfrastructureEnv(
  env: Record<string, string | undefined>,
): InfrastructureEnv {
  return infrastructureEnvSchema.parse(env);
}

export function parseAuthEnv(
  env: Record<string, string | undefined>,
): AuthEnv {
  return authEnvSchema.parse(env);
}

export function parseR2Env(
  env: Record<string, string | undefined>,
): R2Env {
  return r2EnvSchema.parse(env);
}

export function parsePushcutEnv(
  env: Record<string, string | undefined>,
): PushcutEnv {
  return pushcutEnvSchema.parse(env);
}

export function parseWebEnv(
  env: Record<string, string | undefined>,
): WebEnv {
  return webEnvSchema.parse(env);
}