import {
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class ListAdsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsIn([
    'ACTIVE',
    'CANCELED',
  ])
  status?:
    | 'ACTIVE'
    | 'CANCELED';
}