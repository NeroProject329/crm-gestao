export function moneyToCents(
  value: string,
): bigint {
  const normalized =
    value.trim();

  const match =
    /^(-?)(\d+)(?:\.(\d{1,2}))?$/
      .exec(normalized);

  if (!match) {
    throw new Error(
      `Invalid money value: ${value}`,
    );
  }

  const sign =
    match[1] === '-'
      ? -1n
      : 1n;

  const integer =
    BigInt(match[2]);

  const decimals =
    (
      match[3] ?? ''
    )
      .padEnd(
        2,
        '0',
      );

  const cents =
    BigInt(
      decimals || '0',
    );

  return (
    (
      integer *
      100n
    ) +
    cents
  ) * sign;
}

export function formatBRLFromCents(
  cents: bigint,
): string {
  const negative =
    cents < 0n;

  const absolute =
    negative
      ? -cents
      : cents;

  const integer =
    absolute /
    100n;

  const decimal =
    (
      absolute %
      100n
    )
      .toString()
      .padStart(
        2,
        '0',
      );

  const integerFormatted =
    integer
      .toString()
      .replace(
        /\B(?=(\d{3})+(?!\d))/g,
        '.',
      );

  return `${
    negative
      ? '-'
      : ''
  }R$ ${integerFormatted},${decimal}`;
}

export function formatBRL(
  value: string,
): string {
  return formatBRLFromCents(
    moneyToCents(
      value,
    ),
  );
}

export function formatBusinessDate(
  value: string,
): string {
  const [
    year,
    month,
    day,
  ] =
    value.split('-');

  return `${day}/${month}/${year}`;
}