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
  id:
    string;

  eventType:
    string;

  attempts:
    number;
}

/* =========================================================
   ASYNC EVENTS

   Eventos encaminhados para BullMQ e processados pelo
   DomainEventHandler.

   Settlement events são governança de estado:
   atualmente não recalculam Financial Engine, mas passam
   pelo consumer para preservar o pipeline de Outbox.
========================================================= */

const ASYNC_EVENTS =
  new Set<string>([
    /* =====================================================
       FINANCIAL POLICIES
    ===================================================== */

    'bank-fee-policy.changed',

    'employee-commission-policy.changed',

    /* =====================================================
       ADS
    ===================================================== */

    'ads.changed',

    /* =====================================================
       RECEIPTS
    ===================================================== */

    'receipt.submitted',

    'receipt.approved',

    'receipt.reversed',

    /* =====================================================
       WEEKLY SETTLEMENTS
    ===================================================== */

    'settlement.closed',

    'settlement.reviewed',

    'settlement.paid',
  ]);

/* =========================================================
   KNOWN NO-OP EVENTS

   Eventos conhecidos que não causam efeito assíncrono
   financeiro.

   São marcados PROCESSED diretamente.
========================================================= */

const KNOWN_NOOP_EVENTS =
  new Set<string>([
    /*
     * PENDING / REJECTED / CANCELED
     * não alteram faturamento aprovado.
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

  /* =======================================================
     BOOTSTRAP
  ======================================================= */

  onApplicationBootstrap():
    void {
    /*
     * Executamos imediatamente uma rodada
     * quando o Worker inicia.
     */
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

  /* =======================================================
     SHUTDOWN
  ======================================================= */

  onApplicationShutdown():
    void {
    if (this.timer) {
      clearInterval(
        this.timer,
      );
    }
  }

  /* =======================================================
     TICK

     Impede polling concorrente dentro da mesma
     instância do Worker.

     Concorrência entre múltiplas instâncias é protegida
     pelo SELECT ... FOR UPDATE SKIP LOCKED.
  ======================================================= */

  private async tick():
    Promise<void> {
    if (this.running) {
      return;
    }

    this.running =
      true;

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
    } catch (
      error
    ) {
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
      this.running =
        false;
    }
  }

  /* =======================================================
     CLAIM EVENTS

     PostgreSQL é responsável por garantir que múltiplos
     Workers não reivindiquem o mesmo evento simultaneamente.
  ======================================================= */

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

  /* =======================================================
     DISPATCH
  ======================================================= */

  private async dispatch(
    event:
      ClaimedOutboxEvent,
  ): Promise<void> {
    try {
      /* ===================================================
         KNOWN NO-OP

         Evento válido que propositalmente não possui
         processamento assíncrono.
      =================================================== */

      if (
        KNOWN_NOOP_EVENTS.has(
          event.eventType,
        )
      ) {
        await this.state
          .markProcessed(
            event.id,
          );

        this.logger.log(
          JSON.stringify({
            event:
              'outbox.noop.processed',

            outboxEventId:
              event.id,

            eventType:
              event.eventType,
          }),
        );

        return;
      }

      /* ===================================================
         UNKNOWN EVENT

         Falha permanente.

         Isso evita aceitar silenciosamente um novo
         eventType sem consumer correspondente.
      =================================================== */

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

      /* ===================================================
         ASYNC EVENT

         Não marcamos PROCESSED aqui.

         O OutboxEvent continua PROCESSING até o
         DomainEventWorker concluir o efeito.

         Só então OutboxStateService.markProcessed()
         é chamado pelo consumer.
      =================================================== */

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
    } catch (
      error
    ) {
      /*
       * Falha ao colocar/processar o evento no pipeline.
       *
       * Mantemos retry com backoff.
       */
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

  /* =======================================================
     EXHAUSTED PROCESSING LEASES

     Evento pode ficar PROCESSING caso:

       Worker seja encerrado
       conexão caia
       processo morra
       deploy ocorra durante job

     Depois do lease ele pode ser recuperado.

     Se já atingiu maxAttempts, marcamos FAILED.
  ======================================================= */

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