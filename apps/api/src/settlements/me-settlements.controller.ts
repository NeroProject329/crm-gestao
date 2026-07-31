import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

import type {
  EmployeeWeeklySettlementView,
  FinancialAdjustmentView,
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
  ListSettlementsQueryDto,
} from './dto/list-settlements-query.dto';

import {
  SettlementsService,
} from './settlements.service';

@Roles('EMPLOYEE')
@Controller(
  'api/v1/me/settlements',
)
export class MeSettlementsController {
  constructor(
    private readonly settlements:
      SettlementsService,
  ) {}

  /* =======================================================
     HISTORY

     O employeeId nunca vem do browser.

     Sempre:
       @CurrentEmployeeId()
  ======================================================= */

  @Get()
  list(
    @CurrentUser()
    auth:
      AuthContext,

    @CurrentEmployeeId()
    employeeId:
      string,

    @Query()
    query:
      ListSettlementsQueryDto,
  ): Promise<
    EmployeeWeeklySettlementView[]
  > {
    return this.settlements
      .listMy(
        auth.companyId,
        employeeId,
        query,
      );
  }

  /* =======================================================
     CURRENT WEEK

     Precisa ficar ANTES conceitualmente da rota dinâmica.

     GET /me/settlements/current
  ======================================================= */

  @Get(
    'current',
  )
  current(
    @CurrentUser()
    auth:
      AuthContext,

    @CurrentEmployeeId()
    employeeId:
      string,
  ): Promise<
    EmployeeWeeklySettlementView
  > {
    return this.settlements
      .currentMy(
        auth.companyId,
        employeeId,
      );
  }

  /* =======================================================
     ADJUSTMENTS

     Mesmo conhecendo o settlementId,
     o funcionário só consegue consultar quando:

       settlement.companyId = sessão.companyId
       settlement.employeeId = sessão.employeeId
       settlement.id = settlementId

     Caso contrário: 404.
  ======================================================= */

  @Get(
    ':settlementId/adjustments',
  )
  adjustments(
    @CurrentUser()
    auth:
      AuthContext,

    @CurrentEmployeeId()
    employeeId:
      string,

    @Param(
      'settlementId',
    )
    settlementId:
      string,
  ): Promise<
    FinancialAdjustmentView[]
  > {
    return this.settlements
      .listMyAdjustments(
        auth.companyId,
        employeeId,
        settlementId,
      );
  }
}