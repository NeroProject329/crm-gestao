import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import type {
  ReceiptUploadInitResponse,
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
  InitReceiptUploadDto,
} from './dto/init-receipt-upload.dto';

import {
  ReceiptStorageService,
} from './receipt-storage.service';

@Roles('EMPLOYEE')
@Controller(
  'api/v1/me/receipt-uploads',
)
export class ReceiptUploadController {
  constructor(
    private readonly storage:
      ReceiptStorageService,
  ) {}

  @Post('init')
  init(
    @CurrentUser()
    auth: AuthContext,

    @CurrentEmployeeId()
    employeeId: string,

    @Body()
    dto: InitReceiptUploadDto,
  ): Promise<ReceiptUploadInitResponse> {
    return this.storage
      .createUpload(
        auth.companyId,
        employeeId,
        dto.mimeType,
        dto.sizeBytes,
      );
  }
}