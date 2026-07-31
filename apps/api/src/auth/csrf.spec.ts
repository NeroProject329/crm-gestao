import {
  ForbiddenException,
} from '@nestjs/common';

import {
  assertCsrf,
} from './csrf';

describe(
  'assertCsrf',
  () => {
    const token =
      'csrf-token-1234567890';

    it(
      'accepts identical cookie and header tokens',
      () => {
        expect(
          () =>
            assertCsrf(
              token,
              token,
            ),
        ).not.toThrow();
      },
    );

    it(
      'rejects when cookie token is missing',
      () => {
        expect(
          () =>
            assertCsrf(
              undefined,
              token,
            ),
        ).toThrow(
          ForbiddenException,
        );
      },
    );

    it(
      'rejects when header token is missing',
      () => {
        expect(
          () =>
            assertCsrf(
              token,
              undefined,
            ),
        ).toThrow(
          ForbiddenException,
        );
      },
    );

    it(
      'rejects different tokens',
      () => {
        expect(
          () =>
            assertCsrf(
              token,
              'csrf-token-xxxxxxxxxx',
            ),
        ).toThrow(
          ForbiddenException,
        );
      },
    );

    it(
      'rejects header arrays',
      () => {
        expect(
          () =>
            assertCsrf(
              token,
              [
                token,
              ],
            ),
        ).toThrow(
          ForbiddenException,
        );
      },
    );
  },
);