import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';

import type {
  AdminRankingView,
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
  DashboardQueryDto,
} from '../dashboard/dto/dashboard-query.dto';

import {
  RankingService,
} from './ranking.service';

@Roles('ADMIN')
@Controller(
  'api/v1/admin/ranking',
)
export class RankingController {
  constructor(
    private readonly ranking:
      RankingService,
  ) {}

  @Get()
  getRanking(
    @CurrentUser()
    auth:
      AuthContext,

    @Query()
    query:
      DashboardQueryDto,
  ): Promise<AdminRankingView> {
    return this.ranking
      .ranking(
        auth.companyId,
        query,
      );
  }
}