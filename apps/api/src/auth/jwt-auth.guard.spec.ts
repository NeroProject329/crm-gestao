import {
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  JwtService,
} from '@nestjs/jwt';

import {
  CompanyStatus,
  UserStatus,
} from '@crm/database';

import type {
  DatabaseService,
} from '../database/database.service';

import {
  ACCESS_COOKIE,
} from './auth.constants';

import {
  JwtAuthGuard,
} from './jwt-auth.guard';

interface TestRequest {
  headers: {
    authorization?:
      string;
  };

  cookies:
    Record<
      string,
      string |
      undefined
    >;

  auth?:
    unknown;
}

function createContext(
  request:
    TestRequest,
): ExecutionContext {
  return {
    getHandler:
      jest.fn(),

    getClass:
      jest.fn(),

    switchToHttp:
      jest.fn(
        () => ({
          getRequest:
            () =>
              request,
        }),
      ),
  } as unknown as
    ExecutionContext;
}

function activeAdminSession() {
  return {
    id:
      'session-1',

    userId:
      'user-1',

    revokedAt:
      null,

    expiresAt:
      new Date(
        Date.now() +
          60_000,
      ),

    user: {
      id:
        'user-1',

      companyId:
        'company-1',

      role:
        'ADMIN',

      status:
        UserStatus.ACTIVE as UserStatus,

      employee:
        null,

      company: {
        status:
          CompanyStatus.ACTIVE as CompanyStatus,
      },
    },
  };
}

function activeEmployeeSession() {
  return {
    id:
      'session-1',

    userId:
      'user-1',

    revokedAt:
      null,

    expiresAt:
      new Date(
        Date.now() +
          60_000,
      ),

    user: {
      id:
        'user-1',

      companyId:
        'company-1',

      role:
        'EMPLOYEE',

      status:
        UserStatus.ACTIVE as UserStatus,

      employee: {
        id:
          'employee-1',

        active:
          true,
      },

      company: {
        status:
          CompanyStatus.ACTIVE as CompanyStatus,
      },
    },
  };
}

describe(
  'JwtAuthGuard',
  () => {
    let verifyAsync:
      jest.Mock;

    let findFirst:
      jest.Mock;

    let reflector:
      {
        getAllAndOverride:
          jest.Mock;
      };

    let guard:
      JwtAuthGuard;

    const originalSecret =
      process.env
        .JWT_ACCESS_SECRET;

    beforeAll(
      () => {
        /*
         * parseAuthEnv exige segredo
         * com no mÃ­nimo 32 caracteres.
         *
         * Ã‰ apenas valor de teste.
         */
        process.env
          .JWT_ACCESS_SECRET =
          'jwt-test-secret-123456789012345678901234';
      },
    );

    afterAll(
      () => {
        if (
          originalSecret ===
          undefined
        ) {
          delete process.env
            .JWT_ACCESS_SECRET;

          return;
        }

        process.env
          .JWT_ACCESS_SECRET =
          originalSecret;
      },
    );

    beforeEach(
      () => {
        verifyAsync =
          jest.fn();

        findFirst =
          jest.fn();

        reflector = {
          getAllAndOverride:
            jest
              .fn()
              .mockReturnValue(
                false,
              ),
        };

        const jwt = {
          verifyAsync,
        };

        const database = {
          prisma: {
            refreshSession: {
              findFirst,
            },
          },
        };

        guard =
          new JwtAuthGuard(
            jwt as unknown as
              JwtService,

            reflector as unknown as
              Reflector,

            database as unknown as
              DatabaseService,
          );
      },
    );

    /* =====================================================
       PUBLIC ROUTES
    ===================================================== */

    it(
      'allows public route without token',
      async () => {
        reflector
          .getAllAndOverride
          .mockReturnValue(
            true,
          );

        const request:
          TestRequest = {
            headers: {},
            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).resolves.toBe(
          true,
        );

        expect(
          verifyAsync,
        ).not.toHaveBeenCalled();

        expect(
          findFirst,
        ).not.toHaveBeenCalled();
      },
    );

    /* =====================================================
       TOKEN
    ===================================================== */

    it(
      'rejects request without access token',
      async () => {
        const request:
          TestRequest = {
            headers: {},
            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );

        expect(
          verifyAsync,
        ).not.toHaveBeenCalled();

        expect(
          findFirst,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects invalid JWT',
      async () => {
        verifyAsync
          .mockRejectedValue(
            new Error(
              'invalid signature',
            ),
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer invalid-token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );

        expect(
          findFirst,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects JWT payload without required claims',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            /*
             * sid ausente.
             */
            companyId:
              'company-1',
          });

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );

        expect(
          findFirst,
        ).not.toHaveBeenCalled();
      },
    );

    /* =====================================================
       SESSION
    ===================================================== */

    it(
      'requires a non-revoked and non-expired session',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            companyId:
              'company-1',
          });

        findFirst
          .mockResolvedValue(
            activeAdminSession(),
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).resolves.toBe(
          true,
        );

        expect(
          findFirst,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining({
                id:
                  'session-1',

                userId:
                  'user-1',

                revokedAt:
                  null,

                expiresAt: {
                  gt:
                    expect.any(
                      Date,
                    ),
                },
              }),
          }),
        );
      },
    );

    it(
      'rejects when active session lookup returns nothing',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-revoked-or-expired',

            companyId:
              'company-1',
          });

        /*
         * Uma sessÃ£o revogada ou expirada
         * nÃ£o satisfaz o WHERE do guard:
         *
         * revokedAt = null
         * expiresAt > now
         *
         * portanto Prisma retorna null.
         */
        findFirst
          .mockResolvedValue(
            null,
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    /* =====================================================
       USER STATUS
    ===================================================== */

    it(
      'rejects inactive user',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            companyId:
              'company-1',
          });

        const session =
          activeAdminSession();

        session.user.status =
          UserStatus.INACTIVE;

        findFirst
          .mockResolvedValue(
            session,
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    /* =====================================================
       COMPANY STATUS
    ===================================================== */

    it(
      'rejects inactive company',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            companyId:
              'company-1',
          });

        const session =
          activeAdminSession();

        session
          .user
          .company
          .status =
          CompanyStatus.INACTIVE;

        findFirst
          .mockResolvedValue(
            session,
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    it(
      'rejects when JWT company differs from session company',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            /*
             * Token diz company-2.
             */
            companyId:
              'company-2',
          });

        /*
         * UsuÃ¡rio pertence Ã  company-1.
         */
        findFirst
          .mockResolvedValue(
            activeAdminSession(),
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    /* =====================================================
       EMPLOYEE STATUS
    ===================================================== */

    it(
      'rejects EMPLOYEE without employee profile',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            companyId:
              'company-1',
          });

        const session =
          activeEmployeeSession();

        session.user.employee =
          null as unknown as
            typeof session.user.employee;

        findFirst
          .mockResolvedValue(
            session,
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    it(
      'rejects inactive EMPLOYEE',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            companyId:
              'company-1',
          });

        const session =
          activeEmployeeSession();

        session
          .user
          .employee
          .active =
          false;

        findFirst
          .mockResolvedValue(
            session,
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      },
    );

    /* =====================================================
       AUTH CONTEXT
    ===================================================== */

    it(
      'creates ADMIN auth context from valid Bearer session',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            companyId:
              'company-1',
          });

        findFirst
          .mockResolvedValue(
            activeAdminSession(),
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer valid-token',
            },

            cookies: {},
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).resolves.toBe(
          true,
        );

        expect(
          request.auth,
        ).toEqual({
          userId:
            'user-1',

          companyId:
            'company-1',

          employeeId:
            null,

          role:
            'ADMIN',

          sessionId:
            'session-1',

          source:
            'bearer',
        });
      },
    );

    it(
      'creates EMPLOYEE auth context from valid cookie session',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            companyId:
              'company-1',
          });

        findFirst
          .mockResolvedValue(
            activeEmployeeSession(),
          );

        const request:
          TestRequest = {
            headers: {},

            cookies: {
              [ACCESS_COOKIE]:
                'valid-cookie-token',
            },
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).resolves.toBe(
          true,
        );

        expect(
          request.auth,
        ).toEqual({
          userId:
            'user-1',

          companyId:
            'company-1',

          employeeId:
            'employee-1',

          role:
            'EMPLOYEE',

          sessionId:
            'session-1',

          source:
            'cookie',
        });
      },
    );

    it(
      'prioritizes Bearer token over access cookie',
      async () => {
        verifyAsync
          .mockResolvedValue({
            sub:
              'user-1',

            sid:
              'session-1',

            companyId:
              'company-1',
          });

        findFirst
          .mockResolvedValue(
            activeAdminSession(),
          );

        const request:
          TestRequest = {
            headers: {
              authorization:
                'Bearer bearer-token',
            },

            cookies: {
              [ACCESS_COOKIE]:
                'cookie-token',
            },
          };

        await expect(
          guard.canActivate(
            createContext(
              request,
            ),
          ),
        ).resolves.toBe(
          true,
        );

        expect(
          verifyAsync,
        ).toHaveBeenCalledWith(
          'bearer-token',

          expect.objectContaining({
            secret:
              process.env
                .JWT_ACCESS_SECRET,
          }),
        );

        expect(
          request.auth,
        ).toEqual(
          expect.objectContaining({
            source:
              'bearer',
          }),
        );
      },
    );
  },
);
