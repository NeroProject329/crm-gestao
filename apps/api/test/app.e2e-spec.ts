import {
  type INestApplication,
} from '@nestjs/common';

import {
  Test,
  type TestingModule,
} from '@nestjs/testing';

import request
  from 'supertest';

import {
  AppController,
} from '../src/app.controller';

import {
  AppService,
} from '../src/app.service';

describe(
  'AppController (e2e)',
  () => {
    let app:
      INestApplication;

    beforeAll(
      async () => {
        /*
         * Este teste verifica somente
         * o endpoint público de health.
         *
         * Não precisamos inicializar:
         *
         * - PostgreSQL
         * - Redis
         * - R2
         * - Worker
         * - Auth
         *
         * Os E2E de segurança possuem
         * seu próprio módulo controlado.
         */
        const moduleFixture:
          TestingModule =
          await Test
            .createTestingModule({
              controllers: [
                AppController,
              ],

              providers: [
                AppService,
              ],
            })
            .compile();

        app =
          moduleFixture
            .createNestApplication();

        await app.init();
      },
    );

    afterAll(
      async () => {
        await app.close();
      },
    );

    it(
      '/health (GET)',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/health',
          )
          .expect(
            200,
          )
          .expect({
            status:
              'ok',

            service:
              'crm-api',
          });
      },
    );
  },
);