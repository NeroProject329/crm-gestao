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

import {
  SettlementReconciliationService,
  type RecalculationOrigin,
} from './settlement-reconciliation.service';

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

    private readonly settlements:
      SettlementReconciliationService,
  ) {}

  async recalculateEmployeeFrom(
    employeeId:
      string,

    startDate:
      BusinessDate,

    origin?:
      RecalculationOrigin,
  ): Promise<
    RecalculationSummary |
    null
  > {
    const startedAt =
      Date.now();

    /*
     * A reconciliação dos settlements acontece
     * NA MESMA TRANSAÇÃO e sob o mesmo advisory
     * lock do recálculo do funcionário.
     *
     * Evitamos duas correções concorrentes
     * reconciliando o mesmo fechamento.
     */
    const result =
      await this.db.prisma
        .$transaction(
          async (
            transaction,
          ) => {
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

            const summary =
              await engine
                .recalculateEmployeeFrom(
                  employeeId,
                  startDate,
                );

            /*
             * DailyFinancialResult já foi
             * atualizado acima.
             *
             * Agora reconciliamos os fechamentos
             * usando exatamente esse novo estado.
             */
            await this.settlements
              .reconcileAfterRecalculation(
                transaction,
                employeeId,
                startDate,
                origin,
              );

            return summary;
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

        originType:
          origin
            ?.type ??
          null,

        originId:
          origin
            ?.id ??
          null,

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