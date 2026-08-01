import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@crm/contracts';
import { AppService } from './app.service';
import {
  Public,
} from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

@Public()
@Get('health')
getHealth(): HealthResponse {
  return this.appService.getHealth();
}
}

// staging rollback drill
