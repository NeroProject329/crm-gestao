import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import {
  UnrecoverableError,
  Worker,
  type Job,
} from 'bullmq';

import {
  PushDeliveryStatus,
  UserStatus,
} from '@crm/database';

import {
  businessDateInTimezone,
  parseBusinessDate,
} from '../common/business-date';

import {
  safeErrorMessage,
} from '../common/retry';

import {
  DatabaseService,
} from '../infra/database.service';

import {
  WorkerConfigService,
} from '../infra/worker-config.service';

import {
  WorkerFinancialRecalculationService,
} from '../financial/worker-financial-recalculation.service';

import {
  JOB_NAMES,
  QUEUE_NAMES,
  type MaintenanceJobData,
} from '../queue/queue.constants';

import {
  QueuesService,
} from '../queue/queues.service';

import {
  createRedisOptions,
} from '../queue/redis';

@Injectable()
export class MaintenanceWorker
  implements
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger =
    new Logger(
      MaintenanceWorker.name,
    );

  private worker:
    Worker<MaintenanceJobData> |
    undefined;

  constructor(
    private readonly db:
      DatabaseService,

    private readonly config:
      WorkerConfigService,

    private readonly financial:
      WorkerFinancialRecalculationService,

    private readonly queues:
      QueuesService,
  ) {}

  onApplicationBootstrap():
    void {
    this.worker =
      new Worker<MaintenanceJobData>(
        QUEUE_NAMES.maintenance,

        async (
          job,
        ) =>
          this.process(
            job,
          ),

        {
          connection:
            createRedisOptions(
              this.config
                .redisUrl,

              'worker',
            ),

          concurrency:
            this.config
              .maintenanceConcurrency,
        },
      );

    this.worker.on(
      'failed',
      (
        job,
        error,
      ) => {
        this.logger.error(
          JSON.stringify({
            event:
              'maintenance.job.failed',

            jobId:
              job?.id,

            jobName:
              job?.name,

            message:
              safeErrorMessage(
                error,
              ),
          }),
        );
      },
    );

    this.worker.on(
      'error',
      (error) => {
        this.logger.error(
          JSON.stringify({
            event:
              'maintenance.worker.error',

            message:
              safeErrorMessage(
                error,
              ),
          }),
        );
      },
    );
  }

  async onApplicationShutdown():
    Promise<void> {
    if (this.worker) {
      await this.worker
        .close();
    }
  }

  private async process(
    job:
      Job<MaintenanceJobData>,
  ): Promise<void> {
    switch (
      job.name
    ) {
      case JOB_NAMES.ensureDailyResults:
        await this
          .ensureDailyResults();

        return;

      case JOB_NAMES.retryPushDeliveries:
        await this
          .retryPushDeliveries();

        return;

      default:
        throw new UnrecoverableError(
          `Unsupported maintenance job: ${job.name}.`,
        );
    }
  }

  private async ensureDailyResults():
    Promise<void> {
    const employees =
      await this.db.prisma
        .employee
        .findMany({
          where: {
            active:
              true,

            user: {
              status:
                UserStatus.ACTIVE,
            },
          },

          select: {
            id:
              true,

            user: {
              select: {
                company: {
                  select: {
                    settings: {
                      select: {
                        timezone:
                          true,
                      },
                    },
                  },
                },
              },
            },
          },

          orderBy: {
            createdAt:
              'asc',
          },
        });

    for (
      const employee
      of employees
    ) {
      try {
        const timezone =
          employee
            .user
            .company
            .settings
            ?.timezone;

        if (!timezone) {
          throw new Error(
            'Company timezone not configured.',
          );
        }

        const businessDate =
          businessDateInTimezone(
            new Date(),
            timezone,
          );

        const existing =
          await this.db.prisma
            .dailyFinancialResult
            .findUnique({
              where: {
                employeeId_businessDate:
                  {
                    employeeId:
                      employee.id,

                    businessDate:
                      parseBusinessDate(
                        businessDate,
                      ),
                  },
              },

              select: {
                id:
                  true,
              },
            });

        if (existing) {
          continue;
        }

        await this.financial
          .recalculateEmployeeFrom(
            employee.id,
            businessDate,
          );

        this.logger.log(
          JSON.stringify({
            event:
              'maintenance.daily-result.ensured',

            employeeId:
              employee.id,

            businessDate,
          }),
        );
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            event:
              'maintenance.daily-result.failed',

            employeeId:
              employee.id,

            message:
              safeErrorMessage(
                error,
              ),
          }),
        );
      }
    }
  }

  private async retryPushDeliveries():
    Promise<void> {
    if (
      !this.config
        .pushcutConfigured
    ) {
      return;
    }

    const now =
      new Date();

    const deliveries =
      await this.db.prisma
        .pushDelivery
        .findMany({
          where: {
            attempts: {
              lt:
                this.config
                  .pushMaxAttempts,
            },

            OR: [
              {
                status:
                  PushDeliveryStatus.PENDING,
              },

              {
                status:
                  PushDeliveryStatus.FAILED,

                nextAttemptAt: {
                  lte:
                    now,
                },
              },
            ],
          },

          orderBy: {
            createdAt:
              'asc',
          },

          take:
            100,

          select: {
            id:
              true,

            attempts:
              true,
          },
        });

    for (
      const delivery
      of deliveries
    ) {
      try {
        await this.queues
          .ensurePushJob(
            delivery.id,

            this.config
              .pushMaxAttempts -
              delivery
                .attempts,
          );
      } catch (error) {
        this.logger.error(
          JSON.stringify({
            event:
              'maintenance.push-recovery.failed',

            pushDeliveryId:
              delivery.id,

            message:
              safeErrorMessage(
                error,
              ),
          }),
        );
      }
    }
  }
}