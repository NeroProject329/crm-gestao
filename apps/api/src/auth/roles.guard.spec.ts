import {
  ForbiddenException,
  type ExecutionContext,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  RolesGuard,
} from './roles.guard';

function createContext(
  role:
    'ADMIN' |
    'EMPLOYEE',
): ExecutionContext {
  const request = {
    auth: {
      userId:
        'user-1',

      companyId:
        'company-1',

      employeeId:
        role === 'EMPLOYEE'
          ? 'employee-1'
          : null,

      role,

      sessionId:
        'session-1',

      source:
        'cookie',
    },
  };

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

describe(
  'RolesGuard',
  () => {
    let reflector:
      {
        getAllAndOverride:
          jest.Mock;
      };

    let guard:
      RolesGuard;

    beforeEach(
      () => {
        reflector = {
          getAllAndOverride:
            jest.fn(),
        };

        guard =
          new RolesGuard(
            reflector as unknown as
              Reflector,
          );
      },
    );

    it(
      'allows routes without role restriction',
      () => {
        reflector
          .getAllAndOverride
          .mockReturnValue(
            undefined,
          );

        expect(
          guard.canActivate(
            createContext(
              'EMPLOYEE',
            ),
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      'allows ADMIN on ADMIN route',
      () => {
        reflector
          .getAllAndOverride
          .mockReturnValue([
            'ADMIN',
          ]);

        expect(
          guard.canActivate(
            createContext(
              'ADMIN',
            ),
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      'blocks EMPLOYEE from ADMIN route',
      () => {
        reflector
          .getAllAndOverride
          .mockReturnValue([
            'ADMIN',
          ]);

        expect(
          () =>
            guard.canActivate(
              createContext(
                'EMPLOYEE',
              ),
            ),
        ).toThrow(
          ForbiddenException,
        );
      },
    );

    it(
      'blocks ADMIN from EMPLOYEE-only route',
      () => {
        reflector
          .getAllAndOverride
          .mockReturnValue([
            'EMPLOYEE',
          ]);

        expect(
          () =>
            guard.canActivate(
              createContext(
                'ADMIN',
              ),
            ),
        ).toThrow(
          ForbiddenException,
        );
      },
    );
  },
);