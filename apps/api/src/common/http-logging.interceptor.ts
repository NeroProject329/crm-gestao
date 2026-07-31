import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';

import type {
  Request,
  Response,
} from 'express';

import type {
  Observable,
} from 'rxjs';

import {
  catchError,
  tap,
  throwError,
} from 'rxjs';

import type {
  AuthContext,
} from '../auth/auth-context';

interface ObservabilityRequest
  extends Request {
  requestId?:
    string;

  auth?:
    AuthContext;
}

@Injectable()
export class HttpLoggingInterceptor
  implements NestInterceptor
{
  private readonly logger =
    new Logger(
      'HTTP',
    );

  intercept(
    context:
      ExecutionContext,

    next:
      CallHandler,
  ): Observable<unknown> {
    const http =
      context.switchToHttp();

    const request =
      http.getRequest<
        ObservabilityRequest
      >();

    const response =
      http.getResponse<
        Response
      >();

    const startedAt =
      process.hrtime.bigint();

    /*
     * request.path não contém query string.
     *
     * Evitamos colocar parâmetros potencialmente
     * sensíveis nos logs.
     */
    const path =
      request.path;

    const base = {
      requestId:
        request.requestId ??
        null,

      method:
        request.method,

      path,

      companyId:
        request.auth
          ?.companyId ??
        null,

      userId:
        request.auth
          ?.userId ??
        null,

      employeeId:
        request.auth
          ?.employeeId ??
        null,

      role:
        request.auth
          ?.role ??
        null,
    };

    return next
      .handle()
      .pipe(
        tap(() => {
          const durationMs =
            this.durationMs(
              startedAt,
            );

          this.logger.log(
            JSON.stringify({
              event:
                'http.request.completed',

              ...base,

              statusCode:
                response.statusCode,

              durationMs,
            }),
          );
        }),

        catchError(
          (
            error:
              unknown,
          ) => {
            const durationMs =
              this.durationMs(
                startedAt,
              );

            const statusCode =
              error instanceof
                HttpException
                ? error
                    .getStatus()
                : 500;

            /*
             * Não registramos:
             *
             * - Authorization
             * - cookies
             * - JWT
             * - senha
             * - body
             * - comprovante
             * - payload completo
             *
             * Nem mesmo error.message é incluída
             * por padrão para evitar vazamento
             * acidental de SQL/provider/secrets.
             */
            this.logger.error(
              JSON.stringify({
                event:
                  'http.request.failed',

                ...base,

                statusCode,

                durationMs,

                errorType:
                  error instanceof
                    Error
                    ? error.name
                    : 'UnknownError',
              }),
            );

            return throwError(
              () =>
                error,
            );
          },
        ),
      );
  }

  private durationMs(
    startedAt:
      bigint,
  ): number {
    const elapsed =
      process.hrtime.bigint() -
      startedAt;

    return Number(
      elapsed /
      1_000_000n,
    );
  }
}