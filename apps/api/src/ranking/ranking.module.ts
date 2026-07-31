import {
  Module,
} from '@nestjs/common';

import {
  DashboardModule,
} from '../dashboard/dashboard.module';

import {
  RankingController,
} from './ranking.controller';

import {
  RankingService,
} from './ranking.service';

@Module({
  imports: [
    DashboardModule,
  ],

  controllers: [
    RankingController,
  ],

  providers: [
    RankingService,
  ],
})
export class RankingModule {}