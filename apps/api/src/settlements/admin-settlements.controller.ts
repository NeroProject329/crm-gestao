import {
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import type {
  AdminCurrentWeekView,
  AdminWeeklySettlementView,
  FinancialAdjustmentView,
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
  ListSettlementsQueryDto,
} from './dto/list-settlements-query.dto';

import {
  SettlementsService,
} from './settlements.service';

@Roles('ADMIN')
@Controller(
  'api/v1/admin/settlements',
)
export class AdminSettlementsController {
  constructor(
    private readonly settlements:
      SettlementsService,
  ) {}

  /* =======================================================
     LIST
  ======================================================= */

  @Get()
  list(
    @CurrentUser()
    auth:
      AuthContext,

    @Query()
    query:
      ListSettlementsQueryDto,
  ): Promise<
    AdminWeeklySettlementView[]
  > {
    return this.settlements
      .listAdmin(
        auth.companyId,
        query,
      );
  }

  /* =======================================================
     CURRENT WEEK SYNC

     Cria os OPEN ainda inexistentes
     e sincroniza os OPEN já existentes.
  ======================================================= */

  @Post(
    'current/sync',
  )
  syncCurrent(
    @CurrentUser()
    auth:
      AuthContext,
  ): Promise<
    AdminCurrentWeekView
  > {
    return this.settlements
      .syncCurrentWeek(
        auth.companyId,
      );
  }

  /* =======================================================
     ADJUSTMENTS
  ======================================================= */

  @Get(
    ':settlementId/adjustments',
  )
  adjustments(
    @CurrentUser()
    auth:
      AuthContext,

    @Param(
      'settlementId',
    )
    settlementId:
      string,
  ): Promise<
    FinancialAdjustmentView[]
  > {
    return this.settlements
      .listAdminAdjustments(
        auth.companyId,
        settlementId,
      );
  }

  /* =======================================================
     CLOSE

     OPEN → CLOSED
  ======================================================= */

  @Post(
    ':settlementId/close',
  )
  close(
    @CurrentUser()
    auth:
      AuthContext,

    @Param(
      'settlementId',
    )
    settlementId:
      string,
  ): Promise<
    AdminWeeklySettlementView
  > {
    return this.settlements
      .close(
        auth,
        settlementId,
      );
  }

  /* =======================================================
     REVIEW

     REVIEW_REQUIRED → CLOSED
  ======================================================= */

  @Post(
    ':settlementId/review',
  )
  review(
    @CurrentUser()
    auth:
      AuthContext,

    @Param(
      'settlementId',
    )
    settlementId:
      string,
  ): Promise<
    AdminWeeklySettlementView
  > {
    return this.settlements
      .review(
        auth,
        settlementId,
      );
  }

  /* =======================================================
     PAY

     CLOSED → PAID
  ======================================================= */

  @Post(
    ':settlementId/pay',
  )
  pay(
    @CurrentUser()
    auth:
      AuthContext,

    @Param(
      'settlementId',
    )
    settlementId:
      string,
  ): Promise<
    AdminWeeklySettlementView
  > {
    return this.settlements
      .pay(
        auth,
        settlementId,
      );
  }
}