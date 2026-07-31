import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import {
  UnrecoverableError,
  Worker,
  type Job,
} from 'bullmq';

import {
  PushDeliveryStatus,
  UserStatus,
} from '@crm/database';

import {
  exponentialBackoffMs,
  safeErrorMessage,
} from '../common/retry';

import {
  DatabaseService,
} from '../infra/database.service';

import {
  WorkerConfigService,
} from '../infra/worker-config.service';

import {
  QUEUE_NAMES,
  type PushJobData,
} from '../queue/queue.constants';

import {
  createRedisOptions,
} from '../queue/redis';

import {
  PushcutClient,
  PushcutHttpError,
} from './pushcut.client';

@Injectable()
export class PushWorker
  implements
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger =
    new Logger(
      PushWorker.name,
    );

  private worker:
    Worker<PushJobData> |
    undefined;

  constructor(
    private readonly db:
      DatabaseService,

    private readonly config:
      WorkerConfigService,

    private readonly pushcut:
      PushcutClient,
  ) {}

  onApplicationBootstrap():
    void {
    this.worker =
      new Worker<PushJobData>(
        QUEUE_NAMES.push,

        async (
          job,
        ) =>
          this.process(
            job,
          ),

        {
          connection:
            createRedisOptions(
              this.config
                .redisUrl,

              'worker',
            ),

          concurrency:
            this.config
              .pushConcurrency,
        },
      );

    this.worker.on(
      'completed',
      (job) => {
        this.logger.log(
          JSON.stringify({
            event:
              'push.job.completed',

            jobId:
              job.id,

            pushDeliveryId:
              job.data
                .pushDeliveryId,
          }),
        );
      },
    );

    this.worker.on(
      'failed',
      (
        job,
        error,
      ) => {
        this.logger.error(
          JSON.stringify({
            event:
              'push.job.failed',

            jobId:
              job?.id,

            pushDeliveryId:
              job?.data
                .pushDeliveryId,

            attempt:
              job
                ?.attemptsMade,

            message:
              safeErrorMessage(
                error,
              ),
          }),
        );
      },
    );

    this.worker.on(
      'stalled',
      (jobId) => {
        this.logger.warn(
          JSON.stringify({
            event:
              'push.job.stalled',

            jobId,
          }),
        );
      },
    );

    this.worker.on(
      'error',
      (error) => {
        this.logger.error(
          JSON.stringify({
            event:
              'push.worker.error',

            message:
              safeErrorMessage(
                error,
              ),
          }),
        );
      },
    );
  }

  async onApplicationShutdown():
    Promise<void> {
    if (this.worker) {
      await this.worker
        .close();
    }
  }

  private async process(
    job:
      Job<PushJobData>,
  ): Promise<void> {
    const delivery =
      await this.db.prisma
        .pushDelivery
        .findUnique({
          where: {
            id:
              job.data
                .pushDeliveryId,
          },

          include: {
            notification:
              true,

            user: {
              select: {
                status:
                  true,
              },
            },
          },
        });

    if (!delivery) {
      throw new UnrecoverableError(
        `PushDelivery not found: ${job.data.pushDeliveryId}.`,
      );
    }

    if (
      delivery.status ===
      PushDeliveryStatus.SENT
    ) {
      return;
    }

    /*
     * Provider ausente não derruba
     * o Worker financeiro.
     *
     * Também não consome attempts
     * externos porque nenhum request
     * foi realizado.
     */
    if (
      !this.config
        .pushcutConfigured
    ) {
      await this.db.prisma
        .pushDelivery
        .update({
          where: {
            id:
              delivery.id,
          },

          data: {
            status:
              PushDeliveryStatus.FAILED,

            lastError:
              'Pushcut is not configured.',

            nextAttemptAt:
              new Date(
                Date.now() +
                  60_000,
              ),
          },
        });

      throw new Error(
        'Pushcut is not configured.',
      );
    }

    if (
      delivery.user.status !==
      UserStatus.ACTIVE
    ) {
      await this.db.prisma
        .pushDelivery
        .update({
          where: {
            id:
              delivery.id,
          },

          data: {
            status:
              PushDeliveryStatus.FAILED,

            lastError:
              'Push recipient is inactive.',

            nextAttemptAt:
              null,
          },
        });

      throw new UnrecoverableError(
        'Push recipient is inactive.',
      );
    }

    if (
      delivery.attempts >=
      this.config
        .pushMaxAttempts
    ) {
      throw new UnrecoverableError(
        `PushDelivery ${delivery.id} reached the attempt limit.`,
      );
    }

    const attempt =
      delivery.attempts +
      1;

    try {
      const result =
        await this.pushcut
          .send(
            delivery.id,

            delivery
              .notification
              .title,

            delivery
              .notification
              .message,
          );

      await this.db.prisma
        .pushDelivery
        .update({
          where: {
            id:
              delivery.id,
          },

          data: {
            status:
              PushDeliveryStatus.SENT,

            attempts:
              attempt,

            lastError:
              null,

            providerId:
              result
                .providerId,

            nextAttemptAt:
              null,

            sentAt:
              new Date(),
          },
        });
    } catch (error) {
      const retryable =
        error instanceof
          PushcutHttpError
          ? error.retryable
          : true;

      const canRetry =
        retryable &&
        attempt <
          this.config
            .pushMaxAttempts;

      const delayMs =
        exponentialBackoffMs(
          attempt,

          this.config
            .pushBackoffBaseMs,

          60 *
            60 *
            1_000,
        );

      await this.db.prisma
        .pushDelivery
        .update({
          where: {
            id:
              delivery.id,
          },

          data: {
            status:
              PushDeliveryStatus.FAILED,

            attempts:
              attempt,

            lastError:
              safeErrorMessage(
                error,
              ),

            nextAttemptAt:
              canRetry
                ? new Date(
                    Date.now() +
                      delayMs,
                  )
                : null,
          },
        });

      if (!canRetry) {
        throw new UnrecoverableError(
          safeErrorMessage(
            error,
          ),
        );
      }

      if (
        error instanceof
          Error
      ) {
        throw error;
      }

      throw new Error(
        safeErrorMessage(
          error,
        ),
      );
    }
  }
}