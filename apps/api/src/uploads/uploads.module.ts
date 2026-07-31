import {
  Module,
} from '@nestjs/common';

import {
  ReceiptUploadController,
} from './receipt-upload.controller';

import {
  ReceiptStorageService,
} from './receipt-storage.service';

import {
  ReceiptUploadTokenService,
} from './receipt-upload-token.service';

@Module({
  controllers: [
    ReceiptUploadController,
  ],

  providers: [
    ReceiptUploadTokenService,
    ReceiptStorageService,
  ],

  exports: [
    ReceiptStorageService,
  ],
})
export class UploadsModule {}