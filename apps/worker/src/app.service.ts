import { Injectable, Logger } from '@nestjs/common';
import type { ServiceId } from '@crm/contracts';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  private readonly service: ServiceId = 'crm-worker';

  start(): void {
    this.logger.log(`CRM Worker ready: ${this.service}`);
  }
}
