import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  Test,
} from '@nestjs/testing';

import cookieParser
  from 'cookie-parser';

import request
  from 'supertest';

import type {
  AuthContext,
} from '../src/auth/auth-context';

import {
  CSRF_COOKIE,
} from '../src/auth/auth.constants';

import {
  CsrfGuard,
} from '../src/auth/csrf.guard';

import {
  RolesGuard,
} from '../src/auth/roles.guard';

import {
  AdminSettlementsController,
} from '../src/settlements/admin-settlements.controller';

import {
  MeSettlementsController,
} from '../src/settlements/me-settlements.controller';

import {
  SettlementsService,
} from '../src/settlements/settlements.service';

/*
 * Somente a autenticação é simulada.
 *
 * Depois dela entram:
 *
 * - RolesGuard real
 * - CsrfGuard real
 * - decorators reais
 * - DTO validation real
 * - controllers reais
 */
class TestAuthGuard
  implements CanActivate
{
  canActivate(
    context:
      ExecutionContext,
  ): boolean {
    const requestObject =
      context
        .switchToHttp()
        .getRequest<{
          headers:
            Record<
              string,
              string |
              string[] |
              undefined
            >;

          auth?:
            AuthContext;
        }>();

    const role =
      requestObject
        .headers[
          'x-test-role'
        ];

    if (
      role !== 'ADMIN' &&
      role !== 'EMPLOYEE'
    ) {
      throw new UnauthorizedException();
    }

    const sourceHeader =
      requestObject
        .headers[
          'x-test-auth-source'
        ];

    const source =
      sourceHeader === 'bearer'
        ? 'bearer'
        : 'cookie';

    const companyHeader =
      requestObject
        .headers[
          'x-test-company-id'
        ];

    const companyId =
      typeof companyHeader ===
        'string'
        ? companyHeader
        : 'company-1';

    const employeeHeader =
      requestObject
        .headers[
          'x-test-employee-id'
        ];

    requestObject.auth = {
      userId:
        role === 'ADMIN'
          ? 'admin-user-1'
          : 'employee-user-1',

      companyId,

      employeeId:
        role === 'EMPLOYEE'
          ? (
              typeof employeeHeader ===
                'string'
                ? employeeHeader
                : 'employee-session'
            )
          : null,

      role,

      sessionId:
        'e2e-session',

      source,
    };

    return true;
  }
}

describe(
  'Security HTTP E2E',
  () => {
    let app:
      INestApplication;

    const listAdmin =
      jest.fn();

    const syncCurrentWeek =
      jest.fn();

    const listMy =
      jest.fn();

    const currentMy =
      jest.fn();

    const listAdminAdjustments =
      jest.fn();

    const listMyAdjustments =
      jest.fn();

    const close =
      jest.fn();

    const review =
      jest.fn();

    const pay =
      jest.fn();

    beforeAll(
      async () => {
        const moduleRef =
          await Test
            .createTestingModule({
              controllers: [
                AdminSettlementsController,
                MeSettlementsController,
              ],

              providers: [
                {
                  provide:
                    SettlementsService,

                  useValue: {
                    listAdmin,

                    syncCurrentWeek,

                    listMy,

                    currentMy,

                    listAdminAdjustments,

                    listMyAdjustments,

                    close,

                    review,

                    pay,
                  },
                },
              ],
            })
            .compile();

        app =
          moduleRef
            .createNestApplication();

        app.use(
          cookieParser(),
        );

        /*
         * Mesma política utilizada
         * pela aplicação real.
         */
        app.useGlobalPipes(
          new ValidationPipe({
            whitelist:
              true,

            forbidNonWhitelisted:
              true,

            transform:
              true,
          }),
        );

        const reflector =
          app.get(
            Reflector,
          );

        /*
         * Ordem equivalente à proteção
         * utilizada pela API:
         *
         * Authentication
         * → RBAC
         * → CSRF
         */
        app.useGlobalGuards(
          new TestAuthGuard(),

          new RolesGuard(
            reflector,
          ),

          new CsrfGuard(
            reflector,
          ),
        );

        await app.init();
      },
    );

    afterAll(
      async () => {
        await app.close();
      },
    );

    beforeEach(
      () => {
        jest
          .clearAllMocks();

        listAdmin
          .mockResolvedValue(
            [],
          );

        syncCurrentWeek
          .mockResolvedValue({
            periodStart:
              '2026-07-27',

            periodEnd:
              '2026-08-02',

            settlements:
              [],
          });

        listMy
          .mockResolvedValue(
            [],
          );

        currentMy
          .mockResolvedValue({
            id:
              'settlement-1',

            periodStart:
              '2026-07-27',

            periodEnd:
              '2026-08-02',

            status:
              'OPEN',

            approvedRevenue:
              '0.00',

            bankCost:
              '0.00',

            adsCost:
              '0.00',

            employeeAmount:
              '0.00',

            openingAdsDebt:
              '0.00',

            closingAdsDebt:
              '0.00',

            closedAt:
              null,

            paidAt:
              null,

            createdAt:
              '2026-07-27T00:00:00.000Z',

            updatedAt:
              '2026-07-27T00:00:00.000Z',
          });
      },
    );

    /* =====================================================
       AUTHENTICATION
    ===================================================== */

    it(
      'returns 401 when authentication context is missing',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/admin/settlements',
          )
          .expect(
            401,
          );

        expect(
          listAdmin,
        ).not.toHaveBeenCalled();
      },
    );

    /* =====================================================
       RBAC
    ===================================================== */

    it(
      'blocks EMPLOYEE from ADMIN endpoint',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/admin/settlements',
          )
          .set(
            'X-Test-Role',
            'EMPLOYEE',
          )
          .expect(
            403,
          );

        expect(
          listAdmin,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'allows ADMIN on ADMIN endpoint',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/admin/settlements',
          )
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .expect(
            200,
          );

        expect(
          listAdmin,
        ).toHaveBeenCalledWith(
          'company-1',
          expect.anything(),
        );
      },
    );

    /* =====================================================
       COMPANY CONTEXT
    ===================================================== */

    it(
      'derives companyId from authenticated context',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/admin/settlements',
          )
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .set(
            'X-Test-Company-Id',
            'company-session-b',
          )
          .expect(
            200,
          );

        expect(
          listAdmin,
        ).toHaveBeenCalledWith(
          'company-session-b',
          expect.anything(),
        );
      },
    );

    /* =====================================================
       EMPLOYEE OWNERSHIP
    ===================================================== */

    it(
      'uses employeeId from authenticated session even when attacker sends another employeeId',
      async () => {
        const attackerTarget =
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/me/settlements',
          )
          .query({
            employeeId:
              attackerTarget,
          })
          .set(
            'X-Test-Role',
            'EMPLOYEE',
          )
          .set(
            'X-Test-Employee-Id',
            'employee-session-real',
          )
          .expect(
            200,
          );

        expect(
          listMy,
        ).toHaveBeenCalledWith(
          'company-1',

          'employee-session-real',

          expect.objectContaining({
            employeeId:
              attackerTarget,
          }),
        );

        /*
         * O browser conseguiu enviar
         * employeeId no query DTO.
         *
         * Porém o employeeId usado como
         * ownership argument continua sendo
         * exclusivamente o da sessão.
         */
        const call =
          listMy.mock
            .calls[0];

        expect(
          call?.[1],
        ).toBe(
          'employee-session-real',
        );

        expect(
          call?.[1],
        ).not.toBe(
          attackerTarget,
        );
      },
    );

    it(
      'uses authenticated employee for current settlement',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/me/settlements/current',
          )
          .set(
            'X-Test-Role',
            'EMPLOYEE',
          )
          .set(
            'X-Test-Employee-Id',
            'employee-owner',
          )
          .expect(
            200,
          );

        expect(
          currentMy,
        ).toHaveBeenCalledWith(
          'company-1',
          'employee-owner',
        );
      },
    );

    /* =====================================================
       CSRF
    ===================================================== */

    it(
      'blocks cookie authenticated mutation without CSRF token',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .post(
            '/api/v1/admin/settlements/current/sync',
          )
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .set(
            'X-Test-Auth-Source',
            'cookie',
          )
          .expect(
            403,
          );

        expect(
          syncCurrentWeek,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'blocks cookie mutation when CSRF cookie and header are different',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .post(
            '/api/v1/admin/settlements/current/sync',
          )
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .set(
            'X-Test-Auth-Source',
            'cookie',
          )
          .set(
            'Cookie',
            `${CSRF_COOKIE}=csrf-cookie-token`,
          )
          .set(
            'X-CSRF-Token',
            'csrf-wrong-token',
          )
          .expect(
            403,
          );

        expect(
          syncCurrentWeek,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'allows cookie mutation when CSRF cookie and header match',
      async () => {
        const csrfToken =
          'csrf-valid-token-123456';

        await request(
          app.getHttpServer(),
        )
          .post(
            '/api/v1/admin/settlements/current/sync',
          )
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .set(
            'X-Test-Auth-Source',
            'cookie',
          )
          .set(
            'Cookie',
            `${CSRF_COOKIE}=${csrfToken}`,
          )
          .set(
            'X-CSRF-Token',
            csrfToken,
          )
          .expect(
            201,
          );

        expect(
          syncCurrentWeek,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    /*
     * O CsrfGuard real não exige double-submit
     * quando a autenticação veio de Bearer.
     *
     * Esse comportamento é intencional.
     */
    it(
      'does not require CSRF for bearer authenticated mutation',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .post(
            '/api/v1/admin/settlements/current/sync',
          )
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .set(
            'X-Test-Auth-Source',
            'bearer',
          )
          .expect(
            201,
          );

        expect(
          syncCurrentWeek,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    /* =====================================================
       DTO HARDENING
    ===================================================== */

    it(
      'rejects unexpected query parameters',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/admin/settlements',
          )
          .query({
            hackerField:
              'anything',
          })
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .expect(
            400,
          );

        expect(
          listAdmin,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects invalid settlement status',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/admin/settlements',
          )
          .query({
            status:
              'HACKED',
          })
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .expect(
            400,
          );

        expect(
          listAdmin,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects malformed employee UUID',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/admin/settlements',
          )
          .query({
            employeeId:
              'not-a-uuid',
          })
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .expect(
            400,
          );

        expect(
          listAdmin,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'accepts the known settlement status values',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/v1/admin/settlements',
          )
          .query({
            status:
              'PAID',
          })
          .set(
            'X-Test-Role',
            'ADMIN',
          )
          .expect(
            200,
          );

        expect(
          listAdmin,
        ).toHaveBeenCalledWith(
          'company-1',

          expect.objectContaining({
            status:
              'PAID',
          }),
        );
      },
    );
  },
);