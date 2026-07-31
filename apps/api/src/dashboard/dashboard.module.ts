import {
  Module,
} from '@nestjs/common';

import {
  AdminDashboardController,
} from './admin-dashboard.controller';

import {
  AdminDashboardService,
} from './admin-dashboard.service';

import {
  DashboardController,
} from './dashboard.controller';

import {
  DashboardService,
} from './dashboard.service';

@Module({
  controllers: [
    DashboardController,
    AdminDashboardController,
  ],

  providers: [
    DashboardService,
    AdminDashboardService,
  ],

  exports: [
    AdminDashboardService,
  ],
})
export class DashboardModule {}