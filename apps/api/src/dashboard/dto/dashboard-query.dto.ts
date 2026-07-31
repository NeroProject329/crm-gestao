import {
  IsEnum,
  IsOptional,
  Matches,
} from 'class-validator';

export enum DashboardPresetDto {
  TODAY = 'TODAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
  CUSTOM = 'CUSTOM',
}

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(
    DashboardPresetDto,
  )
  preset:
    DashboardPresetDto =
      DashboardPresetDto.MONTH;

  @IsOptional()
  @Matches(
    /^\d{4}-\d{2}-\d{2}$/,
  )
  from?: string;

  @IsOptional()
  @Matches(
    /^\d{4}-\d{2}-\d{2}$/,
  )
  to?: string;
}