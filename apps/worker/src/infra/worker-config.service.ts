import {
  Injectable,
} from '@nestjs/common';

import {
  parseWorkerBootstrapEnv,
  type WorkerBootstrapEnv,
} from '@crm/config';

@Injectable()
export class WorkerConfigService {
  private readonly env:
    WorkerBootstrapEnv;

  constructor() {
    this.env =
      parseWorkerBootstrapEnv(
        process.env,
      );
  }

  get appEnv(): string {
    return this.env.APP_ENV;
  }

  get databaseUrl(): string {
    return this.env
      .DATABASE_URL;
  }

  get redisUrl(): string {
    return this.env
      .REDIS_URL;
  }

  get pushcutBaseUrl(): string {
    return this.env
      .PUSHCUT_BASE_URL;
  }

  get pushcutApiKey():
    string | null {
    return this.env
      .PUSHCUT_API_KEY ??
      null;
  }

  get pushcutNotificationName():
    string | null {
    return this.env
      .PUSHCUT_NOTIFICATION_NAME ??
      null;
  }

  get pushcutConfigured():
    boolean {
    return Boolean(
      this.pushcutApiKey &&
        this
          .pushcutNotificationName,
    );
  }

  get outboxPollMs(): number {
    return this.env
      .WORKER_OUTBOX_POLL_MS;
  }

  get outboxBatchSize(): number {
    return this.env
      .WORKER_OUTBOX_BATCH_SIZE;
  }

  get outboxMaxAttempts():
    number {
    return this.env
      .WORKER_OUTBOX_MAX_ATTEMPTS;
  }

  get outboxBackoffMs():
    number {
    return this.env
      .WORKER_OUTBOX_BACKOFF_MS;
  }

  get outboxLeaseSeconds():
    number {
    return this.env
      .WORKER_OUTBOX_LEASE_SECONDS;
  }

  get jobAttempts(): number {
    return this.env
      .WORKER_JOB_ATTEMPTS;
  }

  get jobBackoffMs(): number {
    return this.env
      .WORKER_JOB_BACKOFF_MS;
  }

  get domainConcurrency():
    number {
    return this.env
      .WORKER_DOMAIN_CONCURRENCY;
  }

  get pushConcurrency(): number {
    return this.env
      .WORKER_PUSH_CONCURRENCY;
  }

  get maintenanceConcurrency():
    number {
    return this.env
      .WORKER_MAINTENANCE_CONCURRENCY;
  }

  get recalcMaxWaitMs():
    number {
    return this.env
      .WORKER_RECALC_MAX_WAIT_MS;
  }

  get recalcTimeoutMs():
    number {
    return this.env
      .WORKER_RECALC_TIMEOUT_MS;
  }

  get schedulerSyncMs():
    number {
    return this.env
      .WORKER_SCHEDULER_SYNC_MS;
  }

  get ensureDailyIntervalMs():
    number {
    return this.env
      .WORKER_ENSURE_DAILY_INTERVAL_MS;
  }

  get pushRecoveryIntervalMs():
    number {
    return this.env
      .WORKER_PUSH_RECOVERY_INTERVAL_MS;
  }

  get pushMaxAttempts():
    number {
    return this.env
      .PUSH_MAX_ATTEMPTS;
  }

  get pushBackoffBaseMs():
    number {
    return this.env
      .PUSH_BACKOFF_BASE_MS;
  }

  get pushHttpTimeoutMs():
    number {
    return this.env
      .PUSH_HTTP_TIMEOUT_MS;
  }
}