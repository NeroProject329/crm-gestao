import * as z from 'zod';

const timezoneSchema = z
  .string()
  .min(1)
  .refine(
    (timezone) => {
      try {
        new Intl.DateTimeFormat(
          'en-US',
          {
            timeZone: timezone,
          },
        );

        return true;
      } catch {
        return false;
      }
    },
    {
      message:
        'Invalid IANA timezone',
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

export const baseEnvSchema =
  z.object({
    NODE_ENV: z
      .enum([
        'development',
        'test',
        'production',
      ])
      .default('development'),

    APP_ENV: z
      .enum([
        'development',
        'staging',
        'production',
      ])
      .default('development'),

    APP_TIMEZONE:
      timezoneSchema.default(
        'UTC',
      ),
  });

export const apiBootstrapEnvSchema =
  baseEnvSchema.extend({
    PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(3001),
  });

export const infrastructureEnvSchema =
  z.object({
    DATABASE_URL:
      postgresUrlSchema,

    REDIS_URL:
      redisUrlSchema,
  });

export const authEnvSchema =
  z.object({
    JWT_ACCESS_SECRET:
      z.string().min(32),

    JWT_ACCESS_TTL_SECONDS:
      z.coerce
        .number()
        .int()
        .min(60)
        .max(86400)
        .default(900),

    AUTH_REFRESH_TTL_DAYS:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(90)
        .default(30),

    AUTH_COOKIE_SAME_SITE:
      z.enum([
        'strict',
        'lax',
        'none',
      ]).default('lax'),

    WEB_ORIGIN:
      z.url().optional(),
  });

export const r2EnvSchema =
  z.object({
    R2_ENDPOINT: z.url(),

    R2_REGION:
      z.string()
        .min(1)
        .default('auto'),

    R2_BUCKET_NAME:
      z.string().min(1),

    R2_ACCESS_KEY_ID:
      z.string().min(1),

    R2_SECRET_ACCESS_KEY:
      z.string().min(1),

    R2_UPLOAD_TOKEN_SECRET:
      z.string().min(32),

    R2_UPLOAD_URL_TTL_SECONDS:
      z.coerce
        .number()
        .int()
        .min(60)
        .max(3600)
        .default(600),

    R2_DOWNLOAD_URL_TTL_SECONDS:
      z.coerce
        .number()
        .int()
        .min(30)
        .max(3600)
        .default(300),

    R2_MAX_RECEIPT_BYTES:
      z.coerce
        .number()
        .int()
        .positive()
        .max(
          50 *
            1024 *
            1024,
        )
        .default(
          10 *
            1024 *
            1024,
        ),
  });

export const pushcutEnvSchema =
  z.object({
    PUSHCUT_BASE_URL:
      z.url().default(
        'https://api.pushcut.io/v1',
      ),

    PUSHCUT_API_KEY:
      z.string().min(1),

    PUSHCUT_NOTIFICATION_NAME:
      z.string()
        .trim()
        .min(1),
  });

export const workerBootstrapEnvSchema =
  baseEnvSchema
    .merge(
      infrastructureEnvSchema,
    )
    .extend({
      /*
       * Pushcut é opcional no bootstrap.
       *
       * Assim uma falha/má configuração do
       * provider externo não derruba o Worker
       * financeiro inteiro.
       */
      PUSHCUT_BASE_URL:
        z.url().default(
          'https://api.pushcut.io/v1',
        ),

      PUSHCUT_API_KEY:
        z.string()
          .min(1)
          .optional(),

      PUSHCUT_NOTIFICATION_NAME:
        z.string()
          .trim()
          .min(1)
          .optional(),

      WORKER_OUTBOX_POLL_MS:
        z.coerce
          .number()
          .int()
          .min(250)
          .max(60_000)
          .default(1_000),

      WORKER_OUTBOX_BATCH_SIZE:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(500)
          .default(50),

      WORKER_OUTBOX_MAX_ATTEMPTS:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(10),

      WORKER_OUTBOX_BACKOFF_MS:
        z.coerce
          .number()
          .int()
          .min(100)
          .max(300_000)
          .default(2_000),

      /*
       * PROCESSING pode ser recuperado
       * depois do lease.
       *
       * 30 min é muito maior que o timeout
       * financeiro padrão de 5 min.
       */
      WORKER_OUTBOX_LEASE_SECONDS:
        z.coerce
          .number()
          .int()
          .min(60)
          .max(86_400)
          .default(1_800),

      WORKER_JOB_ATTEMPTS:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5),

      WORKER_JOB_BACKOFF_MS:
        z.coerce
          .number()
          .int()
          .min(100)
          .max(300_000)
          .default(2_000),

      WORKER_DOMAIN_CONCURRENCY:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(32)
          .default(4),

      WORKER_PUSH_CONCURRENCY:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(32)
          .default(4),

      WORKER_MAINTENANCE_CONCURRENCY:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(8)
          .default(1),

      WORKER_RECALC_MAX_WAIT_MS:
        z.coerce
          .number()
          .int()
          .min(1_000)
          .max(300_000)
          .default(30_000),

      WORKER_RECALC_TIMEOUT_MS:
        z.coerce
          .number()
          .int()
          .min(30_000)
          .max(900_000)
          .default(300_000),

      WORKER_SCHEDULER_SYNC_MS:
        z.coerce
          .number()
          .int()
          .min(10_000)
          .max(600_000)
          .default(60_000),

      WORKER_ENSURE_DAILY_INTERVAL_MS:
        z.coerce
          .number()
          .int()
          .min(10_000)
          .max(3_600_000)
          .default(60_000),

      WORKER_PUSH_RECOVERY_INTERVAL_MS:
        z.coerce
          .number()
          .int()
          .min(10_000)
          .max(3_600_000)
          .default(60_000),

      PUSH_MAX_ATTEMPTS:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5),

      PUSH_BACKOFF_BASE_MS:
        z.coerce
          .number()
          .int()
          .min(1_000)
          .max(300_000)
          .default(5_000),

      PUSH_HTTP_TIMEOUT_MS:
        z.coerce
          .number()
          .int()
          .min(1_000)
          .max(60_000)
          .default(10_000),
    })
    .superRefine(
      (
        value,
        context,
      ) => {
        const hasApiKey =
          Boolean(
            value
              .PUSHCUT_API_KEY,
          );

        const hasName =
          Boolean(
            value
              .PUSHCUT_NOTIFICATION_NAME,
          );

        if (
          hasApiKey !==
          hasName
        ) {
          context.addIssue({
            code:
              'custom',

            message:
              'PUSHCUT_API_KEY and PUSHCUT_NOTIFICATION_NAME must be configured together.',
          });
        }
      },
    );

export const webEnvSchema =
  z.object({
    NEXT_PUBLIC_API_URL:
      z.url(),
  });

export type ApiBootstrapEnv =
  z.infer<
    typeof apiBootstrapEnvSchema
  >;

export type WorkerBootstrapEnv =
  z.infer<
    typeof workerBootstrapEnvSchema
  >;

export type InfrastructureEnv =
  z.infer<
    typeof infrastructureEnvSchema
  >;

export type AuthEnv =
  z.infer<
    typeof authEnvSchema
  >;

export type R2Env =
  z.infer<
    typeof r2EnvSchema
  >;

export type PushcutEnv =
  z.infer<
    typeof pushcutEnvSchema
  >;

export type WebEnv =
  z.infer<
    typeof webEnvSchema
  >;

export function parseApiBootstrapEnv(
  env: Record<
    string,
    string | undefined
  >,
): ApiBootstrapEnv {
  return apiBootstrapEnvSchema
    .parse(env);
}

export function parseWorkerBootstrapEnv(
  env: Record<
    string,
    string | undefined
  >,
): WorkerBootstrapEnv {
  return workerBootstrapEnvSchema
    .parse(env);
}

export function parseInfrastructureEnv(
  env: Record<
    string,
    string | undefined
  >,
): InfrastructureEnv {
  return infrastructureEnvSchema
    .parse(env);
}

export function parseAuthEnv(
  env: Record<
    string,
    string | undefined
  >,
): AuthEnv {
  return authEnvSchema
    .parse(env);
}

export function parseR2Env(
  env: Record<
    string,
    string | undefined
  >,
): R2Env {
  return r2EnvSchema
    .parse(env);
}

export function parsePushcutEnv(
  env: Record<
    string,
    string | undefined
  >,
): PushcutEnv {
  return pushcutEnvSchema
    .parse(env);
}

export function parseWebEnv(
  env: Record<
    string,
    string | undefined
  >,
): WebEnv {
  return webEnvSchema
    .parse(env);
}