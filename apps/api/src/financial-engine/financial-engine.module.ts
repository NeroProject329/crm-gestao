import {
  Global,
  Module,
} from '@nestjs/common';

import {
  FinancialRecalculationService,
} from './financial-recalculation.service';

import {
  PrismaFinancialRecalculationRepository,
} from './financial-recalculation.repository';

@Global()
@Module({
  providers: [
    PrismaFinancialRecalculationRepository,
    FinancialRecalculationService,
  ],

  exports: [
    FinancialRecalculationService,
  ],
})
export class FinancialEngineModule {}