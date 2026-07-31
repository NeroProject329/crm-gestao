import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import type {
  EmployeeReceiptView,
  ReceiptFileUrlResponse,
} from '@crm/contracts';

import type {
  AuthContext,
} from '../auth/auth-context';

import {
  CurrentEmployeeId,
} from '../auth/decorators/current-employee-id.decorator';

import {
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

import {
  Roles,
} from '../auth/decorators/roles.decorator';

import {
  ListMyReceiptsQueryDto,
} from './dto/list-my-receipts-query.dto';

import {
  SubmitReceiptDto,
} from './dto/submit-receipt.dto';

import {
  ReceiptsService,
} from './receipts.service';

@Roles('EMPLOYEE')
@Controller('api/v1/me/receipts')
export class MeReceiptsController {
  constructor(
    private readonly receipts:
      ReceiptsService,
  ) {}

  @Post()
  submit(
    @CurrentUser()
    auth: AuthContext,

    @CurrentEmployeeId()
    employeeId: string,

    @Body()
    dto: SubmitReceiptDto,
  ): Promise<EmployeeReceiptView> {
    return this.receipts.submit(
      auth,
      employeeId,
      dto,
    );
  }

  @Get()
  list(
    @CurrentUser()
    auth: AuthContext,

    @CurrentEmployeeId()
    employeeId: string,

    @Query()
    query:
      ListMyReceiptsQueryDto,
  ): Promise<EmployeeReceiptView[]> {
    return this.receipts.listMy(
      auth.companyId,
      employeeId,
      query,
    );
  }

  @Get(':receiptId/file-url')
  fileUrl(
    @CurrentUser()
    auth: AuthContext,

    @CurrentEmployeeId()
    employeeId: string,

    @Param('receiptId')
    receiptId: string,
  ): Promise<ReceiptFileUrlResponse> {
    return this.receipts
      .getMyFileUrl(
        auth.companyId,
        employeeId,
        receiptId,
      );
  }

  @Post(':receiptId/cancel')
  cancel(
    @CurrentUser()
    auth: AuthContext,

    @CurrentEmployeeId()
    employeeId: string,

    @Param('receiptId')
    receiptId: string,
  ): Promise<EmployeeReceiptView> {
    return this.receipts.cancelMy(
      auth,
      employeeId,
      receiptId,
    );
  }
}