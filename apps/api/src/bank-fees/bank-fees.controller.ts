import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';

import type {
  BankFeePolicyView,
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
  BankFeesService,
} from './bank-fees.service';

import {
  SetBankFeeDto,
} from './dto/set-bank-fee.dto';

@Roles('ADMIN')
@Controller('api/v1/admin/bank-fees')
export class BankFeesController {
  constructor(
    private readonly bankFees:
      BankFeesService,
  ) {}

  @Get()
  list(
    @CurrentUser()
    auth: AuthContext,
  ): Promise<BankFeePolicyView[]> {
    return this.bankFees.list(
      auth.companyId,
    );
  }

  @Post('set')
  set(
    @CurrentUser()
    auth: AuthContext,

    @Body()
    dto: SetBankFeeDto,
  ): Promise<BankFeePolicyView> {
    return this.bankFees.set(
      auth,
      dto,
    );
  }
}