import {
  Injectable,
} from '@nestjs/common';

import {
  OutboxEventStatus,
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

@Injectable()
export class OutboxStateService {
  constructor(
    private readonly db:
      DatabaseService,

    private readonly config:
      WorkerConfigService,
  ) {}

  async markProcessed(
    outboxEventId: string,
  ): Promise<void> {
    await this.db.prisma
      .outboxEvent
      .updateMany({
        where: {
          id:
            outboxEventId,

          status: {
            not:
              OutboxEventStatus.PROCESSED,
          },
        },

        data: {
          status:
            OutboxEventStatus.PROCESSED,

          processedAt:
            new Date(),

          lastError:
            null,
        },
      });
  }

  async recordWorkerError(
    outboxEventId: string,
    error: unknown,
  ): Promise<void> {
    await this.db.prisma
      .outboxEvent
      .updateMany({
        where: {
          id:
            outboxEventId,

          status: {
            not:
              OutboxEventStatus.PROCESSED,
          },
        },

        data: {
          lastError:
            safeErrorMessage(
              error,
            ),
        },
      });
  }

  async markRetryableFailure(
    outboxEventId: string,
    error: unknown,
  ): Promise<void> {
    const event =
      await this.db.prisma
        .outboxEvent
        .findUnique({
          where: {
            id:
              outboxEventId,
          },

          select: {
            attempts:
              true,

            status:
              true,
          },
        });

    if (
      !event ||
      event.status ===
        OutboxEventStatus.PROCESSED
    ) {
      return;
    }

    const exhausted =
      event.attempts >=
      this.config
        .outboxMaxAttempts;

    const delayMs =
      exponentialBackoffMs(
        Math.max(
          1,
          event.attempts,
        ),

        this.config
          .outboxBackoffMs,

        15 *
          60 *
          1_000,
      );

    await this.db.prisma
      .outboxEvent
      .update({
        where: {
          id:
            outboxEventId,
        },

        data: {
          status:
            OutboxEventStatus.FAILED,

          availableAt:
            exhausted
              ? new Date()
              : new Date(
                  Date.now() +
                    delayMs,
                ),

          processedAt:
            null,

          lastError:
            safeErrorMessage(
              error,
            ),
        },
      });
  }

  async markPermanentFailure(
    outboxEventId: string,
    error: unknown,
  ): Promise<void> {
    await this.db.prisma
      .outboxEvent
      .updateMany({
        where: {
          id:
            outboxEventId,

          status: {
            not:
              OutboxEventStatus.PROCESSED,
          },
        },

        data: {
          status:
            OutboxEventStatus.FAILED,

          attempts:
            this.config
              .outboxMaxAttempts,

          processedAt:
            null,

          lastError:
            safeErrorMessage(
              error,
            ),
        },
      });
  }
}