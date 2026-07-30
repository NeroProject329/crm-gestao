import {
  ForbiddenException,
} from '@nestjs/common';

import {
  timingSafeEqual,
} from 'node:crypto';

export function assertCsrf(
  cookieToken: string | undefined,
  headerToken:
    | string
    | string[]
    | undefined,
): void {
  if (
    !cookieToken ||
    typeof headerToken !== 'string'
  ) {
    throw new ForbiddenException(
      'Invalid CSRF token.',
    );
  }

  const left =
    Buffer.from(cookieToken);

  const right =
    Buffer.from(headerToken);

  if (
    left.length !== right.length ||
    !timingSafeEqual(left, right)
  ) {
    throw new ForbiddenException(
      'Invalid CSRF token.',
    );
  }
}