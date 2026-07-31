import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import {
  OutboxEventStatus,
} from '@crm/database';

import {
  safeErrorMessage,
} from '../common/retry';

import {
  DatabaseService,
} from '../infra/database.service';

import {
  WorkerConfigService,
} from '../infra/worker-config.service';

import {
  QueuesService,
} from '../queue/queues.service';

import {
  OutboxStateService,
} from './outbox-state.service';

interface ClaimedOutboxEvent {
  id: string;
  eventType: string;
  attempts: number;
}

const ASYNC_EVENTS =
  new Set<string>([
    'bank-fee-policy.changed',
    'employee-commission-policy.changed',
    'ads.changed',
    'receipt.submitted',
    'receipt.approved',
    'receipt.reversed',
  ]);

const KNOWN_NOOP_EVENTS =
  new Set<string>([
    /*
     * Blueprint:
     * PENDING / REJECTED / CANCELED
     * não alteram faturamento.
     */
    'receipt.rejected',
    'receipt.canceled',
  ]);

@Injectable()
export class OutboxDispatcherService
  implements
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger =
    new Logger(
      OutboxDispatcherService.name,
    );

  private timer:
    NodeJS.Timeout |
    undefined;

  private running =
    false;

  constructor(
    private readonly db:
      DatabaseService,

    private readonly config:
      WorkerConfigService,

    private readonly queues:
      QueuesService,

    private readonly state:
      OutboxStateService,
  ) {}

  onApplicationBootstrap():
    void {
    void this.tick();

    this.timer =
      setInterval(
        () => {
          void this.tick();
        },
        this.config
          .outboxPollMs,
      );
  }

  onApplicationShutdown():
    void {
    if (this.timer) {
      clearInterval(
        this.timer,
      );
    }
  }

  private async tick():
    Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this
        .markExhaustedStaleEvents();

      const events =
        await this
          .claimEvents();

      for (
        const event
        of events
      ) {
        await this.dispatch(
          event,
        );
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event:
            'outbox.dispatcher.error',

          message:
            safeErrorMessage(
              error,
            ),
        }),
      );
    } finally {
      this.running = false;
    }
  }

  private async claimEvents():
    Promise<
      ClaimedOutboxEvent[]
    > {
    const maxAttempts =
      this.config
        .outboxMaxAttempts;

    const batchSize =
      this.config
        .outboxBatchSize;

    const leaseSeconds =
      this.config
        .outboxLeaseSeconds;

    return this.db.prisma
      .$queryRaw<
        ClaimedOutboxEvent[]
      >`
        WITH candidates AS (
          SELECT
            "id"
          FROM
            "outbox_events"
          WHERE
            "attempts" < ${maxAttempts}
            AND (
              (
                "status" IN (
                  'PENDING'::"outbox_event_status",
                  'FAILED'::"outbox_event_status"
                )
                AND
                "available_at" <= NOW()
              )
              OR
              (
                "status" =
                  'PROCESSING'::"outbox_event_status"
                AND
                "updated_at" <=
                  NOW() -
                  (
                    ${leaseSeconds}
                    * INTERVAL '1 second'
                  )
              )
            )
          ORDER BY
            "available_at" ASC,
            "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${batchSize}
        )
        UPDATE
          "outbox_events" AS event
        SET
          "status" =
            'PROCESSING'::"outbox_event_status",
          "attempts" =
            event."attempts" + 1,
          "processed_at" =
            NULL,
          "last_error" =
            NULL,
          "updated_at" =
            NOW()
        FROM
          candidates
        WHERE
          event."id" =
            candidates."id"
        RETURNING
          event."id" AS "id",
          event."event_type" AS "eventType",
          event."attempts" AS "attempts"
      `;
  }

  private async dispatch(
    event:
      ClaimedOutboxEvent,
  ): Promise<void> {
    try {
      if (
        KNOWN_NOOP_EVENTS.has(
          event.eventType,
        )
      ) {
        await this.state
          .markProcessed(
            event.id,
          );

        return;
      }

      if (
        !ASYNC_EVENTS.has(
          event.eventType,
        )
      ) {
        await this.state
          .markPermanentFailure(
            event.id,

            new Error(
              `Unsupported outbox event type: ${event.eventType}.`,
            ),
          );

        this.logger.error(
          JSON.stringify({
            event:
              'outbox.unsupported',

            outboxEventId:
              event.id,

            eventType:
              event.eventType,
          }),
        );

        return;
      }

      /*
       * IMPORTANTE:
       *
       * Não marcamos PROCESSED aqui.
       *
       * PROCESSING permanece até o
       * consumer terminar o efeito.
       */
      await this.queues
        .ensureOutboxJob(
          event.id,
        );

      this.logger.log(
        JSON.stringify({
          event:
            'outbox.dispatched',

          outboxEventId:
            event.id,

          eventType:
            event.eventType,

          attempt:
            event.attempts,
        }),
      );
    } catch (error) {
      await this.state
        .markRetryableFailure(
          event.id,
          error,
        );

      this.logger.error(
        JSON.stringify({
          event:
            'outbox.dispatch.failed',

          outboxEventId:
            event.id,

          eventType:
            event.eventType,

          attempt:
            event.attempts,

          message:
            safeErrorMessage(
              error,
            ),
        }),
      );
    }
  }

  private async markExhaustedStaleEvents():
    Promise<void> {
    const staleBefore =
      new Date(
        Date.now() -
          this.config
            .outboxLeaseSeconds *
            1_000,
      );

    await this.db.prisma
      .outboxEvent
      .updateMany({
        where: {
          status:
            OutboxEventStatus.PROCESSING,

          attempts: {
            gte:
              this.config
                .outboxMaxAttempts,
          },

          updatedAt: {
            lte:
              staleBefore,
          },
        },

        data: {
          status:
            OutboxEventStatus.FAILED,

          lastError:
            'Outbox maximum attempts reached.',
        },
      });
  }
}