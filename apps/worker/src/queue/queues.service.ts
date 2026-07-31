import {
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';

import {
  Queue,
  type JobsOptions,
} from 'bullmq';

import {
  WorkerConfigService,
} from '../infra/worker-config.service';

import {
  createRedisOptions,
} from './redis';

import {
  JOB_NAMES,
  QUEUE_NAMES,
  type MaintenanceJobData,
  type OutboxJobData,
  type PushJobData,
} from './queue.constants';

@Injectable()
export class QueuesService
  implements OnModuleDestroy
{
  private readonly logger =
    new Logger(
      QueuesService.name,
    );

  readonly domainQueue:
    Queue<OutboxJobData>;

  readonly pushQueue:
    Queue<PushJobData>;

  readonly maintenanceQueue:
    Queue<MaintenanceJobData>;

  constructor(
    private readonly config:
      WorkerConfigService,
  ) {
    const connection =
      createRedisOptions(
        this.config.redisUrl,
        'producer',
      );

    this.domainQueue =
      new Queue<OutboxJobData>(
        QUEUE_NAMES.domain,
        {
          connection,
        },
      );

    this.pushQueue =
      new Queue<PushJobData>(
        QUEUE_NAMES.push,
        {
          connection,
        },
      );

    this.maintenanceQueue =
      new Queue<MaintenanceJobData>(
        QUEUE_NAMES.maintenance,
        {
          connection,
        },
      );

    this.attachErrorLogger(
      this.domainQueue,
      QUEUE_NAMES.domain,
    );

    this.attachErrorLogger(
      this.pushQueue,
      QUEUE_NAMES.push,
    );

    this.attachErrorLogger(
      this.maintenanceQueue,
      QUEUE_NAMES.maintenance,
    );
  }

  async ensureOutboxJob(
    outboxEventId: string,
  ): Promise<void> {
    const jobId =
      `outbox-${outboxEventId}`;

    const canCreate =
      await this
        .prepareDeterministicJob(
          this.domainQueue,
          jobId,
        );

    if (!canCreate) {
      return;
    }

    await this.domainQueue.add(
      JOB_NAMES.domainEvent,
      {
        outboxEventId,
      },
      {
        ...this.domainJobOptions(),

        jobId,
      },
    );
  }

  async ensurePushJob(
    pushDeliveryId: string,
    remainingAttempts:
      number,
  ): Promise<void> {
    if (
      remainingAttempts <=
      0
    ) {
      return;
    }

    const jobId =
      `push-${pushDeliveryId}`;

    const canCreate =
      await this
        .prepareDeterministicJob(
          this.pushQueue,
          jobId,
        );

    if (!canCreate) {
      return;
    }

    await this.pushQueue.add(
      JOB_NAMES.pushDelivery,
      {
        pushDeliveryId,
      },
      {
        jobId,

        attempts:
          remainingAttempts,

        backoff: {
          type:
            'exponential',

          delay:
            this.config
              .pushBackoffBaseMs,
        },

        removeOnComplete: {
          age:
            7 *
            24 *
            60 *
            60,

          count:
            100_000,
        },

        removeOnFail: {
          age:
            30 *
            24 *
            60 *
            60,

          count:
            100_000,
        },
      },
    );
  }

  async upsertMaintenanceSchedulers():
    Promise<void> {
    const commonOptions:
      JobsOptions = {
      attempts:
        3,

      backoff: {
        type:
          'exponential',

        delay:
          2_000,
      },

      removeOnComplete: {
        age:
          24 *
          60 *
          60,

        count:
          10_000,
      },

      removeOnFail: {
        age:
          7 *
          24 *
          60 *
          60,

        count:
          10_000,
      },
    };

    await this
      .maintenanceQueue
      .upsertJobScheduler(
        'ensure-daily-results-v1',
        {
          every:
            this.config
              .ensureDailyIntervalMs,
        },
        {
          name:
            JOB_NAMES
              .ensureDailyResults,

          data: {},

          opts:
            commonOptions,
        },
      );

    await this
      .maintenanceQueue
      .upsertJobScheduler(
        'retry-push-deliveries-v1',
        {
          every:
            this.config
              .pushRecoveryIntervalMs,
        },
        {
          name:
            JOB_NAMES
              .retryPushDeliveries,

          data: {},

          opts:
            commonOptions,
        },
      );
  }

  async onModuleDestroy():
    Promise<void> {
    await Promise.all([
      this.domainQueue.close(),
      this.pushQueue.close(),
      this.maintenanceQueue
        .close(),
    ]);
  }

  private domainJobOptions():
    JobsOptions {
    return {
      attempts:
        this.config
          .jobAttempts,

      backoff: {
        type:
          'exponential',

        delay:
          this.config
            .jobBackoffMs,
      },

      removeOnComplete: {
        age:
          7 *
          24 *
          60 *
          60,

        count:
          100_000,
      },

      removeOnFail: {
        age:
          30 *
          24 *
          60 *
          60,

        count:
          100_000,
      },
    };
  }

  private async prepareDeterministicJob<
    T extends object,
  >(
    queue: Queue<T>,
    jobId: string,
  ): Promise<boolean> {
    const existing =
      await queue.getJob(
        jobId,
      );

    if (!existing) {
      return true;
    }

    const state =
      await existing
        .getState();

    if (
      state === 'failed' ||
      state === 'completed'
    ) {
      await existing
        .remove();

      return true;
    }

    if (
      state === 'unknown'
    ) {
      return true;
    }

    /*
     * waiting / active / delayed /
     * prioritized / waiting-children:
     * o trabalho já existe.
     */
    return false;
  }

  private attachErrorLogger<
    T extends object,
  >(
    queue: Queue<T>,
    queueName: string,
  ): void {
    queue.on(
      'error',
      (error) => {
        this.logger.error(
          JSON.stringify({
            event:
              'queue.error',

            queue:
              queueName,

            message:
              error.message,
          }),
        );
      },
    );
  }
}