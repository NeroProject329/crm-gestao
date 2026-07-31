import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import type {
  AdminReceiptActionResponse,
  AdminReceiptView,
  ReceiptFileUrlResponse,
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
  ApproveReceiptDto,
} from './dto/approve-receipt.dto';

import {
  ListAdminReceiptsQueryDto,
} from './dto/list-admin-receipts-query.dto';

import {
  RejectReceiptDto,
} from './dto/reject-receipt.dto';

import {
  ReverseReceiptDto,
} from './dto/reverse-receipt.dto';

import {
  ReceiptsService,
} from './receipts.service';

@Roles('ADMIN')
@Controller(
  'api/v1/admin/receipts',
)
export class AdminReceiptsController {
  constructor(
    private readonly receipts:
      ReceiptsService,
  ) {}

  @Get()
  list(
    @CurrentUser()
    auth: AuthContext,

    @Query()
    query:
      ListAdminReceiptsQueryDto,
  ): Promise<AdminReceiptView[]> {
    return this.receipts
      .listAdmin(
        auth.companyId,
        query,
      );
  }

  @Get(':receiptId/file-url')
  fileUrl(
    @CurrentUser()
    auth: AuthContext,

    @Param('receiptId')
    receiptId: string,
  ): Promise<ReceiptFileUrlResponse> {
    return this.receipts
      .getAdminFileUrl(
        auth.companyId,
        receiptId,
      );
  }

  @Post(':receiptId/approve')
  approve(
    @CurrentUser()
    auth: AuthContext,

    @Param('receiptId')
    receiptId: string,

    @Body()
    dto: ApproveReceiptDto,
  ): Promise<AdminReceiptActionResponse> {
    return this.receipts.approve(
      auth,
      receiptId,
      dto,
    );
  }

  @Post(':receiptId/reject')
  reject(
    @CurrentUser()
    auth: AuthContext,

    @Param('receiptId')
    receiptId: string,

    @Body()
    dto: RejectReceiptDto,
  ): Promise<AdminReceiptActionResponse> {
    return this.receipts.reject(
      auth,
      receiptId,
      dto,
    );
  }

  @Post(':receiptId/reverse')
  reverse(
    @CurrentUser()
    auth: AuthContext,

    @Param('receiptId')
    receiptId: string,

    @Body()
    dto: ReverseReceiptDto,
  ): Promise<AdminReceiptActionResponse> {
    return this.receipts.reverse(
      auth,
      receiptId,
      dto,
    );
  }
}