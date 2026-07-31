import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type {
  AdsEntryView,
  AdsMutationResponse,
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
  AdsService,
} from './ads.service';

import {
  CreateAdsEntryDto,
} from './dto/create-ads-entry.dto';

import {
  UpdateAdsEntryDto,
} from './dto/update-ads-entry.dto';

import {
  ListAdsQueryDto,
} from './dto/list-ads-query.dto';

@Roles('ADMIN')
@Controller('api/v1/admin/ads')
export class AdsController {
  constructor(
    private readonly ads:
      AdsService,
  ) {}

  @Get()
  list(
    @CurrentUser()
    auth: AuthContext,

    @Query()
    query: ListAdsQueryDto,
  ): Promise<AdsEntryView[]> {
    return this.ads.list(
      auth.companyId,
      query,
    );
  }

  @Get(':adsEntryId')
  get(
    @CurrentUser()
    auth: AuthContext,

    @Param('adsEntryId')
    adsEntryId: string,
  ): Promise<AdsEntryView> {
    return this.ads.get(
      auth.companyId,
      adsEntryId,
    );
  }

  @Post()
  create(
    @CurrentUser()
    auth: AuthContext,

    @Body()
    dto: CreateAdsEntryDto,
  ): Promise<AdsMutationResponse> {
    return this.ads.create(
      auth,
      dto,
    );
  }

  @Patch(':adsEntryId')
  update(
    @CurrentUser()
    auth: AuthContext,

    @Param('adsEntryId')
    adsEntryId: string,

    @Body()
    dto: UpdateAdsEntryDto,
  ): Promise<AdsMutationResponse> {
    return this.ads.update(
      auth,
      adsEntryId,
      dto,
    );
  }

  @Post(':adsEntryId/cancel')
  cancel(
    @CurrentUser()
    auth: AuthContext,

    @Param('adsEntryId')
    adsEntryId: string,
  ): Promise<AdsMutationResponse> {
    return this.ads.cancel(
      auth,
      adsEntryId,
    );
  }
}