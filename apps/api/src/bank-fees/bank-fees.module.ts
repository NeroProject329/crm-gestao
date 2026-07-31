import {
  Module,
} from '@nestjs/common';

import {
  BankFeesController,
} from './bank-fees.controller';

import {
  BankFeesService,
} from './bank-fees.service';

@Module({
  controllers: [
    BankFeesController,
  ],

  providers: [
    BankFeesService,
  ],

  exports: [
    BankFeesService,
  ],
})
export class BankFeesModule {}