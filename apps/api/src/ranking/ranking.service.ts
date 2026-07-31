import {
  Injectable,
} from '@nestjs/common';

import type {
  AdminRankingView,
} from '@crm/contracts';

import {
  AdminDashboardService,
} from '../dashboard/admin-dashboard.service';

import type {
  DashboardQueryDto,
} from '../dashboard/dto/dashboard-query.dto';

@Injectable()
export class RankingService {
  constructor(
    private readonly dashboard:
      AdminDashboardService,
  ) {}

  async ranking(
    companyId:
      string,

    query:
      DashboardQueryDto,
  ): Promise<AdminRankingView> {
    const dashboard =
      await this.dashboard
        .adminDashboard(
          companyId,
          query,
        );

    return {
      period:
        dashboard.period,

      items:
        dashboard.ranking,
    };
  }
}