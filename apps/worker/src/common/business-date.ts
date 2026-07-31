import type {
  BusinessDate,
} from '@crm/financial-engine';

const BUSINESS_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}$/;

export function parseBusinessDate(
  value: string,
): Date {
  if (
    !BUSINESS_DATE_REGEX
      .test(value)
  ) {
    throw new Error(
      `Invalid business date: ${value}. Expected YYYY-MM-DD.`,
    );
  }

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    ) ||
    parsed
      .toISOString()
      .slice(0, 10) !==
      value
  ) {
    throw new Error(
      `Invalid business date: ${value}.`,
    );
  }

  return parsed;
}

export function toBusinessDate(
  value: Date,
): BusinessDate {
  return value
    .toISOString()
    .slice(
      0,
      10,
    );
}

export function requireBusinessDate(
  value: string,
): BusinessDate {
  parseBusinessDate(
    value,
  );

  return value;
}

export function businessDateInTimezone(
  value: Date,
  timezone: string,
): BusinessDate {
  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          timezone,

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',
      },
    ).formatToParts(
      value,
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        'year',
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        'month',
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        'day',
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      `Unable to determine business date for timezone ${timezone}.`,
    );
  }

  return `${year}-${month}-${day}`;
}