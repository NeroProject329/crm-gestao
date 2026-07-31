import {
  Module,
} from '@nestjs/common';

import {
  UploadsModule,
} from '../uploads/uploads.module';

import {
  AdminReceiptsController,
} from './admin-receipts.controller';

import {
  MeReceiptsController,
} from './me-receipts.controller';

import {
  ReceiptsService,
} from './receipts.service';

@Module({
  imports: [
    UploadsModule,
  ],

  controllers: [
    MeReceiptsController,
    AdminReceiptsController,
  ],

  providers: [
    ReceiptsService,
  ],

  exports: [
    ReceiptsService,
  ],
})
export class ReceiptsModule {}