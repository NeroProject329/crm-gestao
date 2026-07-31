import {
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class ListSettlementsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?:
    string;

  @IsOptional()
  @IsIn([
    'OPEN',
    'CLOSED',
    'REVIEW_REQUIRED',
    'PAID',
  ])
  status?:
    'OPEN'
    | 'CLOSED'
    | 'REVIEW_REQUIRED'
    | 'PAID';

  @IsOptional()
  @Matches(
    /^\d{4}-\d{2}-\d{2}$/,
  )
  from?:
    string;

  @IsOptional()
  @Matches(
    /^\d{4}-\d{2}-\d{2}$/,
  )
  to?:
    string;
}