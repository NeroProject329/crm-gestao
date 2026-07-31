import {
  BadRequestException,
} from '@nestjs/common';

const BUSINESS_DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}$/;

export function parseBusinessDate(
  value: string,
  fieldName = 'businessDate',
): Date {
  if (
    !BUSINESS_DATE_REGEX.test(value)
  ) {
    throw new BadRequestException(
      `${fieldName} must use YYYY-MM-DD.`,
    );
  }

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed
      .toISOString()
      .slice(0, 10) !== value
  ) {
    throw new BadRequestException(
      `${fieldName} is invalid.`,
    );
  }

  return parsed;
}

export function formatBusinessDate(
  value: Date,
): string {
  return value
    .toISOString()
    .slice(0, 10);
}

export function previousBusinessDate(
  value: Date,
): Date {
  const result =
    new Date(value);

  result.setUTCDate(
    result.getUTCDate() - 1,
  );

  return result;
}


export function businessDateInTimezone(
  value: Date,
  timezone: string,
): string {
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
    ).formatToParts(value);

  const year =
    parts.find(
      (part) =>
        part.type === 'year',
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === 'month',
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === 'day',
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      'Unable to determine business date.',
    );
  }

  return `${year}-${month}-${day}`;
}