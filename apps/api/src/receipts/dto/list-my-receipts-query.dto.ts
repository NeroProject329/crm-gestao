import {
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';

export class ListMyReceiptsQueryDto {
  @IsOptional()
  @IsIn([
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELED',
    'REVERSED',
  ])
  status?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}