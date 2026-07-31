const targets = [
  {
    name: 'API',
    baseUrl:
      process.env
        .SMOKE_API_BASE_URL,
    path:
      '/health',
    expectedService:
      'crm-api',
  },

  {
    name: 'Web',
    baseUrl:
      process.env
        .SMOKE_WEB_BASE_URL,
    path:
      '/api/health',
    expectedService:
      'crm-web',
  },
];

function sleep(
  milliseconds,
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

function resolveHealthUrl(
  baseUrl,
  path,
) {
  const normalized =
    baseUrl
      .trim()
      .replace(
        /\/+$/,
        '',
      );

  return new URL(
    path,
    `${normalized}/`,
  ).toString();
}

async function checkTarget(
  target,
) {
  const url =
    resolveHealthUrl(
      target.baseUrl,
      target.path,
    );

  const maximumAttempts =
    6;

  let lastError;

  for (
    let attempt = 1;
    attempt <= maximumAttempts;
    attempt += 1
  ) {
    try {
      const startedAt =
        Date.now();

      const response =
        await fetch(
          url,
          {
            method:
              'GET',

            headers: {
              Accept:
                'application/json',

              'User-Agent':
                'crm-deployment-smoke/1.0',
            },

            redirect:
              'follow',

            signal:
              AbortSignal.timeout(
                15_000,
              ),
          },
        );

      const text =
        await response.text();

      if (!response.ok) {
        throw new Error(
          `${target.name} returned HTTP ${response.status}: ${text.slice(0, 300)}`,
        );
      }

      let body;

      try {
        body =
          JSON.parse(
            text,
          );
      } catch {
        throw new Error(
          `${target.name} did not return valid JSON.`,
        );
      }

      if (
        body.status !==
          'ok' ||
        body.service !==
          target.expectedService
      ) {
        throw new Error(
          `${target.name} returned an unexpected health payload: ${text.slice(0, 300)}`,
        );
      }

      console.log(
        JSON.stringify({
          event:
            'smoke.completed',

          target:
            target.name,

          url,

          statusCode:
            response.status,

          durationMs:
            Date.now() -
            startedAt,
        }),
      );

      return;
    } catch (
      error
    ) {
      lastError =
        error;

      console.error(
        `[smoke] ${target.name} attempt ${attempt}/${maximumAttempts} failed:`,
        error instanceof Error
          ? error.message
          : error,
      );

      if (
        attempt <
        maximumAttempts
      ) {
        await sleep(
          10_000,
        );
      }
    }
  }

  throw lastError;
}

async function main() {
  const missing =
    targets
      .filter(
        (target) =>
          !target
            .baseUrl
            ?.trim(),
      )
      .map(
        (target) =>
          target.name,
      );

  if (
    missing.length >
    0
  ) {
    throw new Error(
      `Missing smoke base URLs for: ${missing.join(', ')}.`,
    );
  }

  for (
    const target
    of targets
  ) {
    await checkTarget(
      target,
    );
  }

  console.log(
    JSON.stringify({
      event:
        'smoke.all-completed',

      targets:
        targets.length,
    }),
  );
}

main().catch(
  (
    error,
  ) => {
    console.error(
      '[smoke] FAILED',
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);