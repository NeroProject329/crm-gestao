import {
  ConflictException,
} from '@nestjs/common';

import {
  PaymentReceiptStatus,
} from '@crm/database';

import type {
  AuthContext,
} from '../auth/auth-context';

import type {
  DatabaseService,
} from '../database/database.service';

import type {
  ReceiptStorageService,
} from '../uploads/receipt-storage.service';

import {
  ReceiptsService,
} from './receipts.service';

const auth:
  AuthContext = {
    userId:
      'admin-1',

    companyId:
      'company-1',

    employeeId:
      null,

    role:
      'ADMIN',

    sessionId:
      'session-1',

    source:
      'cookie',
  };

describe(
  'ReceiptsService approval idempotency',
  () => {
    it(
      'does not create another financial event when receipt is already APPROVED',
      async () => {
        const transaction =
          jest.fn();

        const database = {
          prisma: {
            $transaction:
              transaction,
          },
        };

        const storage = {};

        const service =
          new ReceiptsService(
            database as unknown as
              DatabaseService,

            storage as
              ReceiptStorageService,
          );

        jest
          .spyOn(
            service as never,
            'findAdminReceipt' as never,
          )
          .mockResolvedValue({
            id:
              'receipt-1',

            status:
              PaymentReceiptStatus.APPROVED,
          } as never);

        jest
          .spyOn(
            service as never,
            'toAdminView' as never,
          )
          .mockReturnValue({
            id:
              'receipt-1',

            status:
              'APPROVED',
          } as never);

        const response =
          await service.approve(
            auth,

            'receipt-1',

            {},
          );

        expect(
          response.recalculation,
        ).toBeNull();

        expect(
          transaction,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects a concurrent second approval before audit/outbox creation',
      async () => {
        const auditCreate =
          jest.fn();

        const outboxCreate =
          jest.fn();

        const tx = {
          paymentReceipt: {
            updateMany:
              jest
                .fn()
                .mockResolvedValue({
                  count:
                    0,
                }),

            findUniqueOrThrow:
              jest.fn(),
          },

          auditLog: {
            create:
              auditCreate,
          },

          outboxEvent: {
            create:
              outboxCreate,
          },
        };

        const transaction =
          jest.fn(
            async (
              callback:
                (
                  value:
                    typeof tx,
                ) =>
                  Promise<unknown>,
            ) =>
              callback(
                tx,
              ),
          );

        const database = {
          prisma: {
            $transaction:
              transaction,
          },
        };

        const storage = {};

        const service =
          new ReceiptsService(
            database as unknown as
              DatabaseService,

            storage as
              ReceiptStorageService,
          );

        jest
          .spyOn(
            service as never,
            'findAdminReceipt' as never,
          )
          .mockResolvedValue({
            id:
              'receipt-1',

            companyId:
              'company-1',

            employeeId:
              'employee-1',

            status:
              PaymentReceiptStatus.PENDING,

            businessDate:
              new Date(
                '2026-07-31T00:00:00.000Z',
              ),
          } as never);

        await expect(
          service.approve(
            auth,

            'receipt-1',

            {},
          ),
        ).rejects.toBeInstanceOf(
          ConflictException,
        );

        expect(
          auditCreate,
        ).not.toHaveBeenCalled();

        expect(
          outboxCreate,
        ).not.toHaveBeenCalled();
      },
    );
  },
);