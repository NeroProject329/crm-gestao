import {
  Module,
} from '@nestjs/common';

import {
  AdminSettlementsController,
} from './admin-settlements.controller';

import {
  MeSettlementsController,
} from './me-settlements.controller';

import {
  SettlementsService,
} from './settlements.service';

@Module({
  controllers: [
    AdminSettlementsController,
    MeSettlementsController,
  ],

  providers: [
    SettlementsService,
  ],

  exports: [
    SettlementsService,
  ],
})
export class SettlementsModule {}