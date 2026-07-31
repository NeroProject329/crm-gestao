import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import type {
  AdminDashboardView,
} from '@crm/contracts';

import type {
  AuthContext,
} from '../auth/auth-context';

import {
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

import {
  Roles,
} from '../auth/decorators/roles.decorator';

import {
  AdminDashboardService,
} from './admin-dashboard.service';

import {
  DashboardQueryDto,
} from './dto/dashboard-query.dto';

@Roles('ADMIN')
@Controller(
  'api/v1/admin/dashboard',
)
export class AdminDashboardController {
  constructor(
    private readonly dashboard:
      AdminDashboardService,
  ) {}

  @Get()
  getDashboard(
    @CurrentUser()
    auth:
      AuthContext,

    @Query()
    query:
      DashboardQueryDto,
  ): Promise<AdminDashboardView> {
    return this.dashboard
      .adminDashboard(
        auth.companyId,
        query,
      );
  }
}