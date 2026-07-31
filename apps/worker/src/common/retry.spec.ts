import {
  exponentialBackoffMs,
  safeErrorMessage,
} from './retry';

describe(
  'retry helpers',
  () => {
    it(
      'uses exponential backoff',
      () => {
        expect(
          exponentialBackoffMs(
            1,
            1_000,
            60_000,
          ),
        ).toBe(
          1_000,
        );

        expect(
          exponentialBackoffMs(
            2,
            1_000,
            60_000,
          ),
        ).toBe(
          2_000,
        );

        expect(
          exponentialBackoffMs(
            3,
            1_000,
            60_000,
          ),
        ).toBe(
          4_000,
        );

        expect(
          exponentialBackoffMs(
            20,
            1_000,
            60_000,
          ),
        ).toBe(
          60_000,
        );
      },
    );

    it(
      'sanitizes error messages',
      () => {
        expect(
          safeErrorMessage(
            new Error(
              'Redis\nconnection failed',
            ),
          ),
        ).toBe(
          'Redis connection failed',
        );
      },
    );
  },
);