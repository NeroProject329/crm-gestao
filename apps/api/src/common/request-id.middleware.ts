import type {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  createRequestId,
} from '@crm/observability';

export interface RequestWithId
  extends Request {
  requestId?:
    string;
}

export function requestIdMiddleware(
  request:
    Request,

  response:
    Response,

  next:
    NextFunction,
): void {
  const incoming =
    request.header(
      'x-request-id',
    );

  const requestId =
    createRequestId(
      incoming,
    );

  (
    request as
      RequestWithId
  ).requestId =
    requestId;

  /*
   * Também devolvemos ao cliente.
   *
   * Isso permite relacionar:
   *
   * erro no navegador
   *      ↓
   * x-request-id
   *      ↓
   * log da API
   */
  response.setHeader(
    'x-request-id',
    requestId,
  );

  next();
}