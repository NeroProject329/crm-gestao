import {
  Injectable,
} from '@nestjs/common';

import {
  safeErrorMessage,
} from '../common/retry';

import {
  WorkerConfigService,
} from '../infra/worker-config.service';

export interface PushcutResult {
  providerId:
    string | null;
}

export class PushcutHttpError
  extends Error
{
  constructor(
    message: string,

    readonly status:
      number | null,

    readonly retryable:
      boolean,
  ) {
    super(message);

    this.name =
      'PushcutHttpError';
  }
}

@Injectable()
export class PushcutClient {
  constructor(
    private readonly config:
      WorkerConfigService,
  ) {}

  async send(
    deliveryId: string,
    title: string,
    message: string,
  ): Promise<PushcutResult> {
    const apiKey =
      this.config
        .pushcutApiKey;

    const notificationName =
      this.config
        .pushcutNotificationName;

    if (
      !apiKey ||
      !notificationName
    ) {
      throw new PushcutHttpError(
        'Pushcut is not configured.',

        null,

        true,
      );
    }

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),

        this.config
          .pushHttpTimeoutMs,
      );

    try {
      const baseUrl =
        this.config
          .pushcutBaseUrl
          .replace(
            /\/+$/,
            '',
          );

      const response =
        await fetch(
          `${baseUrl}/notifications/${encodeURIComponent(notificationName)}`,

          {
            method:
              'POST',

            headers: {
              Accept:
                'application/json',

              'Content-Type':
                'application/json',

              'API-Key':
                apiKey,
            },

            body:
              JSON.stringify({
                title,

                text:
                  message,

                id:
                  deliveryId,

                threadId:
                  'crm-receipts',
              }),

            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        throw new PushcutHttpError(
          `Pushcut returned HTTP ${response.status}.`,

          response.status,

          isRetryableStatus(
            response.status,
          ),
        );
      }

      return {
        providerId:
          await readProviderId(
            response,
          ),
      };
    } catch (error) {
      if (
        error instanceof
          PushcutHttpError
      ) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.name ===
          'AbortError'
      ) {
        throw new PushcutHttpError(
          'Pushcut request timed out.',

          null,

          true,
        );
      }

      throw new PushcutHttpError(
        `Pushcut network error: ${safeErrorMessage(error)}`,

        null,

        true,
      );
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }
}

function isRetryableStatus(
  status: number,
): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

async function readProviderId(
  response: Response,
): Promise<
  string | null
> {
  const contentType =
    response.headers
      .get(
        'content-type',
      )
      ?.toLowerCase();

  if (
    !contentType?.includes(
      'application/json',
    )
  ) {
    return null;
  }

  try {
    const body:
      unknown =
      await response.json();

    if (
      !body ||
      typeof body !==
        'object' ||
      Array.isArray(
        body,
      )
    ) {
      return null;
    }

    const id =
      (
        body as
          Record<
            string,
            unknown
          >
      ).id;

    return typeof id ===
      'string'
      ? id
      : null;
  } catch {
    return null;
  }
}