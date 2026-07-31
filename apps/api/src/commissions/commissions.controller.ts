import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import type {
  EmployeeCommissionPolicyView,
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
  CommissionsService,
} from './commissions.service';

import {
  SetCommissionDto,
} from './dto/set-commission.dto';

@Roles('ADMIN')
@Controller(
  'api/v1/admin/employees/:employeeId/commissions',
)
export class CommissionsController {
  constructor(
    private readonly commissions:
      CommissionsService,
  ) {}

  @Get()
  list(
    @CurrentUser()
    auth: AuthContext,

    @Param('employeeId')
    employeeId: string,
  ): Promise<
    EmployeeCommissionPolicyView[]
  > {
    return this.commissions.list(
      auth.companyId,
      employeeId,
    );
  }

  @Post('set')
  set(
    @CurrentUser()
    auth: AuthContext,

    @Param('employeeId')
    employeeId: string,

    @Body()
    dto: SetCommissionDto,
  ): Promise<EmployeeCommissionPolicyView> {
    return this.commissions.set(
      auth,
      employeeId,
      dto,
    );
  }
}