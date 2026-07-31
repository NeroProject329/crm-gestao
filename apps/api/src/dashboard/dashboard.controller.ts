import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import type {
  EmployeeDashboardView,
} from '@crm/contracts';

import type {
  AuthContext,
} from '../auth/auth-context';

import {
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

import {
  CurrentEmployeeId,
} from '../auth/decorators/current-employee-id.decorator';

import {
  Roles,
} from '../auth/decorators/roles.decorator';

import {
  DashboardService,
} from './dashboard.service';

import {
  DashboardQueryDto,
} from './dto/dashboard-query.dto';

@Roles('EMPLOYEE')
@Controller(
  'api/v1/me/dashboard',
)
export class DashboardController {
  constructor(
    private readonly dashboard:
      DashboardService,
  ) {}

  @Get()
  getDashboard(
    @CurrentUser()
    auth: AuthContext,

    @CurrentEmployeeId()
    employeeId: string,

    @Query()
    query:
      DashboardQueryDto,
  ): Promise<EmployeeDashboardView> {
    return this.dashboard
      .employeeDashboard(
        auth.companyId,
        employeeId,
        query,
      );
  }
}