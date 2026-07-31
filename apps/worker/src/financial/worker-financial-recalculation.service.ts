import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  RecalculationService,
  type BusinessDate,
  type RecalculationSummary,
} from '@crm/financial-engine';

import {
  DatabaseService,
} from '../infra/database.service';

import {
  WorkerConfigService,
} from '../infra/worker-config.service';

import {
  PrismaFinancialRecalculationRepository,
} from './prisma-financial-recalculation.repository';

@Injectable()
export class WorkerFinancialRecalculationService {
  private readonly logger =
    new Logger(
      WorkerFinancialRecalculationService.name,
    );

  constructor(
    private readonly db:
      DatabaseService,

    private readonly config:
      WorkerConfigService,
  ) {}

  async recalculateEmployeeFrom(
    employeeId: string,
    startDate:
      BusinessDate,
  ): Promise<
    RecalculationSummary |
    null
  > {
    const startedAt =
      Date.now();

    const result =
      await this.db.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            /*
             * Lock distribuído por employeeId.
             *
             * pg_advisory_xact_lock retorna
             * PostgreSQL void, então usamos
             * $executeRaw e não $queryRaw.
             *
             * O lock permanece até COMMIT
             * ou ROLLBACK da transação.
             */
            await transaction
              .$executeRaw`
                SELECT
                  pg_advisory_xact_lock(
                    hashtextextended(
                      ${employeeId},
                      0
                    )
                  )
              `;

            const repository =
              new PrismaFinancialRecalculationRepository(
                transaction,
              );

            const currentDate =
              await repository
                .getCurrentBusinessDate(
                  employeeId,
                );

            /*
             * Uma política pode começar
             * numa data futura.
             *
             * Nesse caso ainda não existe
             * nada para recalcular.
             */
            if (
              startDate >
              currentDate
            ) {
              return null;
            }

            const engine =
              new RecalculationService(
                repository,
              );

            return engine
              .recalculateEmployeeFrom(
                employeeId,
                startDate,
              );
          },

          {
            maxWait:
              this.config
                .recalcMaxWaitMs,

            timeout:
              this.config
                .recalcTimeoutMs,
          },
        );

    this.logger.log(
      JSON.stringify({
        event:
          'financial.recalculation.completed',

        employeeId,

        startDate,

        durationMs:
          Date.now() -
          startedAt,

        processedDays:
          result
            ?.processedDays ??
          0,
      }),
    );

    return result;
  }
}