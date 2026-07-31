import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import type {
  AdminEmployeeView,
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
  CreateEmployeeDto,
} from './dto/create-employee.dto';

import {
  UpdateEmployeeDto,
} from './dto/update-employee.dto';

import {
  EmployeesService,
} from './employees.service';

@Roles('ADMIN')
@Controller('api/v1/admin/employees')
export class EmployeesController {
  constructor(
    private readonly employees:
      EmployeesService,
  ) {}

  @Get()
  list(
    @CurrentUser()
    auth: AuthContext,
  ): Promise<AdminEmployeeView[]> {
    return this.employees.list(
      auth.companyId,
    );
  }

  @Get(':employeeId')
  get(
    @CurrentUser()
    auth: AuthContext,

    @Param('employeeId')
    employeeId: string,
  ): Promise<AdminEmployeeView> {
    return this.employees.get(
      auth.companyId,
      employeeId,
    );
  }

  @Post()
  create(
    @CurrentUser()
    auth: AuthContext,

    @Body()
    dto: CreateEmployeeDto,
  ): Promise<AdminEmployeeView> {
    return this.employees.create(
      auth,
      dto,
    );
  }

  @Patch(':employeeId')
  update(
    @CurrentUser()
    auth: AuthContext,

    @Param('employeeId')
    employeeId: string,

    @Body()
    dto: UpdateEmployeeDto,
  ): Promise<AdminEmployeeView> {
    return this.employees.update(
      auth,
      employeeId,
      dto,
    );
  }

  @Post(':employeeId/deactivate')
  deactivate(
    @CurrentUser()
    auth: AuthContext,

    @Param('employeeId')
    employeeId: string,
  ): Promise<AdminEmployeeView> {
    return this.employees.deactivate(
      auth,
      employeeId,
    );
  }

  @Post(':employeeId/activate')
  activate(
    @CurrentUser()
    auth: AuthContext,

    @Param('employeeId')
    employeeId: string,
  ): Promise<AdminEmployeeView> {
    return this.employees.activate(
      auth,
      employeeId,
    );
  }
}