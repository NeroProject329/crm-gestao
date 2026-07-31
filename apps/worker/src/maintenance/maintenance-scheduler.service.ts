import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import {
  safeErrorMessage,
} from '../common/retry';

import {
  WorkerConfigService,
} from '../infra/worker-config.service';

import {
  QueuesService,
} from '../queue/queues.service';

@Injectable()
export class MaintenanceSchedulerService
  implements
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger =
    new Logger(
      MaintenanceSchedulerService.name,
    );

  private timer:
    NodeJS.Timeout |
    undefined;

  private running =
    false;

  constructor(
    private readonly config:
      WorkerConfigService,

    private readonly queues:
      QueuesService,
  ) {}

  onApplicationBootstrap():
    void {
    void this.sync();

    /*
     * Reaplica configuração periodicamente
     * caso Redis estivesse indisponível
     * durante o startup.
     */
    this.timer =
      setInterval(
        () => {
          void this.sync();
        },

        this.config
          .schedulerSyncMs,
      );
  }

  onApplicationShutdown():
    void {
    if (this.timer) {
      clearInterval(
        this.timer,
      );
    }
  }

  private async sync():
    Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.queues
        .upsertMaintenanceSchedulers();

      this.logger.log(
        JSON.stringify({
          event:
            'maintenance.schedulers.synced',
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event:
            'maintenance.schedulers.sync-failed',

          message:
            safeErrorMessage(
              error,
            ),
        }),
      );
    } finally {
      this.running = false;
    }
  }
}