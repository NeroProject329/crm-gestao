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
  safeErrorMessage,
} from '../common/retry';

import {
  WorkerConfigService,
} from '../infra/worker-config.service';

import {
  OutboxStateService,
} from '../outbox/outbox-state.service';

import {
  JOB_NAMES,
  QUEUE_NAMES,
  type OutboxJobData,
} from '../queue/queue.constants';

import {
  createRedisOptions,
} from '../queue/redis';

import {
  DomainEventHandler,
} from './domain-event.handler';

@Injectable()
export class DomainEventWorker
  implements
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger =
    new Logger(
      DomainEventWorker.name,
    );

  private worker:
    Worker<OutboxJobData> |
    undefined;

  constructor(
    private readonly config:
      WorkerConfigService,

    private readonly handler:
      DomainEventHandler,

    private readonly outbox:
      OutboxStateService,
  ) {}

  onApplicationBootstrap():
    void {
    this.worker =
      new Worker<OutboxJobData>(
        QUEUE_NAMES.domain,

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
              .domainConcurrency,
        },
      );

    this.worker.on(
      'completed',
      (job) => {
        this.logger.log(
          JSON.stringify({
            event:
              'domain.job.completed',

            jobId:
              job.id,

            outboxEventId:
              job.data
                .outboxEventId,
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
        void this
          .handleFailed(
            job,
            error,
          );
      },
    );

    this.worker.on(
      'stalled',
      (jobId) => {
        this.logger.warn(
          JSON.stringify({
            event:
              'domain.job.stalled',

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
              'domain.worker.error',

            message:
              safeErrorMessage(
                error,
              ),
          }),
        );
      },
    );

    this.logger.log(
      JSON.stringify({
        event:
          'domain.worker.started',

        queue:
          QUEUE_NAMES.domain,

        jobName:
          JOB_NAMES
            .domainEvent,

        concurrency:
          this.config
            .domainConcurrency,
      }),
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
      Job<OutboxJobData>,
  ): Promise<void> {
    const outboxEventId =
      job.data
        .outboxEventId;

    try {
      await this.handler
        .handle(
          outboxEventId,
        );

      /*
       * Só aqui o evento terminou.
       */
      await this.outbox
        .markProcessed(
          outboxEventId,
        );
    } catch (error) {
      try {
        await this.outbox
          .recordWorkerError(
            outboxEventId,
            error,
          );
      } catch {
        /*
         * Preserva o erro original.
         */
      }

      throw error;
    }
  }

  private async handleFailed(
    job:
      Job<OutboxJobData> |
      undefined,

    error:
      Error,
  ): Promise<void> {
    if (!job) {
      return;
    }

    const permanent =
      error instanceof
        UnrecoverableError ||
      error.name ===
        'UnrecoverableError';

    const attempts =
      job.opts.attempts ??
      1;

    const exhausted =
      job.attemptsMade >=
      attempts;

    this.logger.error(
      JSON.stringify({
        event:
          'domain.job.failed',

        jobId:
          job.id,

        outboxEventId:
          job.data
            .outboxEventId,

        attempt:
          job.attemptsMade,

        attempts,

        permanent,

        message:
          safeErrorMessage(
            error,
          ),
      }),
    );

    try {
      if (permanent) {
        await this.outbox
          .markPermanentFailure(
            job.data
              .outboxEventId,

            error,
          );

        return;
      }

      if (exhausted) {
        /*
         * BullMQ esgotou a rodada.
         *
         * PostgreSQL reabre o evento
         * posteriormente.
         */
        await this.outbox
          .markRetryableFailure(
            job.data
              .outboxEventId,

            error,
          );
      }
    } catch (
      stateError
    ) {
      this.logger.error(
        JSON.stringify({
          event:
            'domain.job.state-update.failed',

          jobId:
            job.id,

          message:
            safeErrorMessage(
              stateError,
            ),
        }),
      );
    }
  }
}