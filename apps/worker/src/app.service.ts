import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';

import type {
  ServiceId,
} from '@crm/contracts';

import {
  WorkerConfigService,
} from './infra/worker-config.service';

@Injectable()
export class AppService
  implements
    OnApplicationBootstrap
{
  private readonly logger =
    new Logger(
      AppService.name,
    );

  private readonly service:
    ServiceId =
      'crm-worker';

  constructor(
    private readonly config:
      WorkerConfigService,
  ) {}

  onApplicationBootstrap():
    void {
    this.logger.log(
      JSON.stringify({
        event:
          'worker.ready',

        service:
          this.service,

        environment:
          this.config.appEnv,

        pushcutConfigured:
          this.config
            .pushcutConfigured,
      }),
    );
  }
}