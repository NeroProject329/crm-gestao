import {
  randomUUID,
} from 'node:crypto';

/*
 * Aceitamos IDs propagados por proxy/gateway,
 * mas somente em formato limitado.
 *
 * Impede log injection e IDs gigantes enviados
 * pelo cliente.
 */
const SAFE_REQUEST_ID =
  /^[A-Za-z0-9._:-]{8,128}$/;

export function createRequestId(
  incoming?:
    string,
): string {
  if (
    incoming &&
    SAFE_REQUEST_ID.test(
      incoming,
    )
  ) {
    return incoming;
  }

  return randomUUID();
}