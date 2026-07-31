export function exponentialBackoffMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
): number {
  const normalized =
    Math.max(
      1,
      Math.trunc(
        attempt,
      ),
    );

  const calculated =
    baseMs *
    2 **
      (normalized - 1);

  return Math.min(
    maxMs,
    calculated,
  );
}

export function safeErrorMessage(
  error: unknown,
  maxLength = 2_000,
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error ===
          'string'
        ? error
        : 'Unknown error';

  const normalized =
    raw
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();

  return (
    normalized ||
    'Unknown error'
  ).slice(
    0,
    maxLength,
  );
}