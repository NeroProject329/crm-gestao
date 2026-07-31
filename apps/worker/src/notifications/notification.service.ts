import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  PushDeliveryStatus,
  UserRole,
  UserStatus,
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

interface ReceiptSubmittedEvent {
  id: string;
  companyId: string;
  aggregateId: string;
}

@Injectable()
export class NotificationService {
  private readonly logger =
    new Logger(
      NotificationService.name,
    );

  constructor(
    private readonly db:
      DatabaseService,

    private readonly config:
      WorkerConfigService,

    private readonly queues:
      QueuesService,
  ) {}

  async handleReceiptSubmitted(
    event:
      ReceiptSubmittedEvent,
  ): Promise<void> {
    const receipt =
      await this.db.prisma
        .paymentReceipt
        .findFirst({
          where: {
            id:
              event
                .aggregateId,

            companyId:
              event
                .companyId,
          },

          select: {
            id:
              true,

            amount:
              true,

            payerName:
              true,

            employee: {
              select: {
                user: {
                  select: {
                    name:
                      true,
                  },
                },
              },
            },
          },
        });

    if (!receipt) {
      throw new Error(
        `Receipt not found: ${event.aggregateId}.`,
      );
    }

    const result =
      await this.db.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const admins =
              await transaction
                .user
                .findMany({
                  where: {
                    companyId:
                      event
                        .companyId,

                    role:
                      UserRole.ADMIN,

                    status:
                      UserStatus.ACTIVE,
                  },

                  select: {
                    id:
                      true,

                    createdAt:
                      true,
                  },

                  orderBy: {
                    createdAt:
                      'asc',
                  },
                });

            const notification =
              await transaction
                .notification
                .upsert({
                  /*
                   * ID do Outbox =
                   * ID determinístico da
                   * Notification.
                   */
                  where: {
                    id:
                      event.id,
                  },

                  create: {
                    id:
                      event.id,

                    companyId:
                      event
                        .companyId,

                    type:
                      'RECEIPT_SUBMITTED',

                    title:
                      'Novo comprovante recebido',

                    message:
                      `${receipt.employee.user.name} enviou um comprovante de R$ ${receipt.amount.toFixed(2)} de ${receipt.payerName}.`,

                    entityType:
                      'PaymentReceipt',

                    entityId:
                      receipt.id,
                  },

                  update: {},
                });

            if (
              admins.length >
              0
            ) {
              await transaction
                .notificationRecipient
                .createMany({
                  data:
                    admins.map(
                      (
                        admin,
                      ) => ({
                        notificationId:
                          notification.id,

                        userId:
                          admin.id,
                      }),
                    ),

                  skipDuplicates:
                    true,
                });
            }

            /*
             * Pushcut da V1 é um provider
             * account-level, com uma única
             * credencial configurada.
             *
             * Todos os ADMINs recebem a
             * notificação interna, mas uma
             * única entrega externa evita
             * mandar o mesmo push N vezes.
             */
            const primaryAdmin =
              admins[0];

            if (
              !primaryAdmin
            ) {
              return {
                push:
                  null,
              };
            }

            const push =
              await transaction
                .pushDelivery
                .upsert({
                  where: {
                    notificationId_userId:
                      {
                        notificationId:
                          notification.id,

                        userId:
                          primaryAdmin.id,
                      },
                  },

                  create: {
                    notificationId:
                      notification.id,

                    userId:
                      primaryAdmin.id,

                    status:
                      PushDeliveryStatus.PENDING,

                    attempts:
                      0,
                  },

                  update: {},
                });

            return {
              push: {
                id:
                  push.id,

                status:
                  push.status,

                attempts:
                  push.attempts,
              },
            };
          },
        );

    if (
      !result.push ||
      result.push.status ===
        PushDeliveryStatus.SENT
    ) {
      return;
    }

    /*
     * PushDelivery já existe no PostgreSQL.
     *
     * Portanto uma falha aqui NÃO perde
     * a notificação; maintenance recupera.
     */
    if (
      !this.config
        .pushcutConfigured
    ) {
      this.logger.warn(
        JSON.stringify({
          event:
            'push.not-configured',

          pushDeliveryId:
            result.push.id,
        }),
      );

      return;
    }

    try {
      await this.queues
        .ensurePushJob(
          result.push.id,

          this.config
            .pushMaxAttempts -
            result.push
              .attempts,
        );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event:
            'push.enqueue.failed',

          pushDeliveryId:
            result.push.id,

          message:
            safeErrorMessage(
              error,
            ),
        }),
      );
    }
  }
}