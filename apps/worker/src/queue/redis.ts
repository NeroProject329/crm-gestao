import type {
  RedisOptions,
} from 'ioredis';

export function createRedisOptions(
  redisUrl: string,
  kind:
    | 'producer'
    | 'worker',
): RedisOptions {
  const url =
    new URL(
      redisUrl,
    );

  if (
    url.protocol !==
      'redis:' &&
    url.protocol !==
      'rediss:'
  ) {
    throw new Error(
      'REDIS_URL must use redis:// or rediss://.',
    );
  }

  const dbText =
    url.pathname
      .replace(
        /^\//,
        '',
      )
      .trim();

  const db =
    dbText.length > 0
      ? Number(
          dbText,
        )
      : 0;

  if (
    !Number.isInteger(
      db,
    ) ||
    db < 0
  ) {
    throw new Error(
      'REDIS_URL contains an invalid database number.',
    );
  }

  return {
    host:
      url.hostname,

    port:
      url.port
        ? Number(
            url.port,
          )
        : 6379,

    username:
      url.username
        ? decodeURIComponent(
            url.username,
          )
        : undefined,

    password:
      url.password
        ? decodeURIComponent(
            url.password,
          )
        : undefined,

    db,

    tls:
      url.protocol ===
      'rediss:'
        ? {}
        : undefined,

    connectionName:
      `crm-worker-${kind}`,

    /*
     * Producer precisa falhar rápido.
     *
     * Se Redis cair, o Outbox continua
     * no PostgreSQL e será tentado depois.
     */
    maxRetriesPerRequest:
      kind ===
      'worker'
        ? null
        : 1,

    enableOfflineQueue:
      kind ===
      'worker',
  };
}