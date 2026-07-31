import {
  Injectable,
} from '@nestjs/common';

import {
  UnrecoverableError,
} from 'bullmq';

import type {
  BusinessDate,
} from '@crm/financial-engine';

import {
  requireBusinessDate,
  toBusinessDate,
} from '../common/business-date';

import {
  DatabaseService,
} from '../infra/database.service';

import {
  NotificationService,
} from '../notifications/notification.service';

import {
  WorkerFinancialRecalculationService,
} from '../financial/worker-financial-recalculation.service';

import type {
  RecalculationOrigin,
} from '../financial/settlement-reconciliation.service';

@Injectable()
export class DomainEventHandler {
  constructor(
    private readonly db:
      DatabaseService,

    private readonly financial:
      WorkerFinancialRecalculationService,

    private readonly notifications:
      NotificationService,
  ) {}

  async handle(
    outboxEventId:
      string,
  ): Promise<void> {
    const event =
      await this.db.prisma
        .outboxEvent
        .findUnique({
          where: {
            id:
              outboxEventId,
          },
        });

    if (!event) {
      throw new UnrecoverableError(
        `OutboxEvent not found: ${outboxEventId}.`,
      );
    }

    if (
      event.status ===
      'PROCESSED'
    ) {
      return;
    }

    /*
     * Origem do recálculo.
     *
     * É propagada até a reconciliação
     * dos WeeklySettlement para que
     * FinancialAdjustment consiga manter
     * rastreabilidade até o OutboxEvent
     * que originou a mudança histórica.
     */
    const origin:
      RecalculationOrigin = {
        type:
          event.eventType,

        id:
          event.id,
      };

    switch (
      event.eventType
    ) {
      /* ===================================================
         RECEIPT SUBMITTED

         Não afeta a verdade financeira ainda.
         Apenas notificação.
      =================================================== */

      case 'receipt.submitted':
        await this.notifications
          .handleReceiptSubmitted({
            id:
              event.id,

            companyId:
              event.companyId,

            aggregateId:
              event.aggregateId,
          });

        return;

      /* ===================================================
         RECEIPT FINANCIAL EVENTS
      =================================================== */

      case 'receipt.approved':
      case 'receipt.reversed':
        await this
          .handleReceiptFinancialEvent(
            event.companyId,
            event.aggregateId,
            origin,
          );

        return;

      /* ===================================================
         ADS
      =================================================== */

      case 'ads.changed':
        await this
          .handleAdsEvent(
            event.companyId,
            event.aggregateId,
            event.payload,
            origin,
          );

        return;

      /* ===================================================
         COMMISSION POLICY
      =================================================== */

      case 'employee-commission-policy.changed':
        await this
          .handleCommissionEvent(
            event.companyId,
            event.payload,
            origin,
          );

        return;

      /* ===================================================
         BANK FEE POLICY
      =================================================== */

      case 'bank-fee-policy.changed':
        await this
          .handleBankFeeEvent(
            event.companyId,
            event.payload,
            origin,
          );

        return;

      /* ===================================================
         NON FINANCIAL RECEIPT EVENTS
      =================================================== */

      case 'receipt.rejected':
      case 'receipt.canceled':
        return;

      /* ===================================================
         SETTLEMENT GOVERNANCE EVENTS

         O estado já foi persistido pela API
         dentro da transação que criou o OutboxEvent.

         Eles NÃO executam novamente o
         Financial Engine.

         O Worker apenas considera o evento
         processado com sucesso.
      =================================================== */

      case 'settlement.closed':
      case 'settlement.reviewed':
      case 'settlement.paid':
        return;

      default:
        throw new UnrecoverableError(
          `Unsupported event type: ${event.eventType}.`,
        );
    }
  }

  /* =======================================================
     RECEIPT FINANCIAL EVENT
  ======================================================= */

  private async handleReceiptFinancialEvent(
    companyId:
      string,

    receiptId:
      string,

    origin:
      RecalculationOrigin,
  ): Promise<void> {
    const receipt =
      await this.db.prisma
        .paymentReceipt
        .findFirst({
          where: {
            id:
              receiptId,

            companyId,
          },

          select: {
            employeeId:
              true,

            businessDate:
              true,
          },
        });

    if (!receipt) {
      throw new UnrecoverableError(
        `PaymentReceipt not found: ${receiptId}.`,
      );
    }

    await this.financial
      .recalculateEmployeeFrom(
        receipt.employeeId,

        toBusinessDate(
          receipt.businessDate,
        ),

        origin,
      );
  }

  /* =======================================================
     ADS EVENT
  ======================================================= */

  private async handleAdsEvent(
    companyId:
      string,

    adsEntryId:
      string,

    payload:
      unknown,

    origin:
      RecalculationOrigin,
  ): Promise<void> {
    const entry =
      await this.db.prisma
        .adsEntry
        .findFirst({
          where: {
            id:
              adsEntryId,

            companyId,
          },

          select: {
            employeeId:
              true,
          },
        });

    if (!entry) {
      throw new UnrecoverableError(
        `AdsEntry not found: ${adsEntryId}.`,
      );
    }

    const effectiveFrom =
      this.requirePayloadBusinessDate(
        payload,
        'effectiveFrom',
      );

    await this.financial
      .recalculateEmployeeFrom(
        entry.employeeId,
        effectiveFrom,
        origin,
      );
  }

  /* =======================================================
     COMMISSION EVENT
  ======================================================= */

  private async handleCommissionEvent(
    companyId:
      string,

    payload:
      unknown,

    origin:
      RecalculationOrigin,
  ): Promise<void> {
    const employeeId =
      this.requirePayloadString(
        payload,
        'employeeId',
      );

    await this
      .assertEmployeeCompany(
        companyId,
        employeeId,
      );

    const effectiveFrom =
      this.requirePayloadBusinessDate(
        payload,
        'effectiveFrom',
      );

    await this.financial
      .recalculateEmployeeFrom(
        employeeId,
        effectiveFrom,
        origin,
      );
  }

  /* =======================================================
     BANK FEE EVENT
  ======================================================= */

  private async handleBankFeeEvent(
    companyId:
      string,

    payload:
      unknown,

    origin:
      RecalculationOrigin,
  ): Promise<void> {
    const effectiveFrom =
      this.requirePayloadBusinessDate(
        payload,
        'effectiveFrom',
      );

    /*
     * Inclusive funcionários inativos.
     *
     * Alteração histórica da taxa bancária
     * precisa preservar consistência histórica
     * de todos que tenham resultados afetados.
     */
    const employees =
      await this.db.prisma
        .employee
        .findMany({
          where: {
            user: {
              companyId,
            },
          },

          select: {
            id:
              true,
          },

          orderBy: {
            createdAt:
              'asc',
          },
        });

    for (
      const employee
      of employees
    ) {
      await this.financial
        .recalculateEmployeeFrom(
          employee.id,
          effectiveFrom,
          origin,
        );
    }
  }

  /* =======================================================
     EMPLOYEE OWNERSHIP
  ======================================================= */

  private async assertEmployeeCompany(
    companyId:
      string,

    employeeId:
      string,
  ): Promise<void> {
    const employee =
      await this.db.prisma
        .employee
        .findFirst({
          where: {
            id:
              employeeId,

            user: {
              companyId,
            },
          },

          select: {
            id:
              true,
          },
        });

    if (!employee) {
      throw new UnrecoverableError(
        `Employee ${employeeId} does not belong to company ${companyId}.`,
      );
    }
  }

  /* =======================================================
     PAYLOAD HELPERS
  ======================================================= */

  private requirePayloadBusinessDate(
    payload:
      unknown,

    key:
      string,
  ): BusinessDate {
    return requireBusinessDate(
      this.requirePayloadString(
        payload,
        key,
      ),
    );
  }

  private requirePayloadString(
    payload:
      unknown,

    key:
      string,
  ): string {
    if (
      !payload ||
      typeof payload !==
        'object' ||
      Array.isArray(
        payload,
      )
    ) {
      throw new UnrecoverableError(
        'Outbox payload must be an object.',
      );
    }

    const value =
      (
        payload as Record<
          string,
          unknown
        >
      )[key];

    if (
      typeof value !==
        'string' ||
      value
        .trim()
        .length ===
        0
    ) {
      throw new UnrecoverableError(
        `Outbox payload is missing ${key}.`,
      );
    }

    return value;
  }
}