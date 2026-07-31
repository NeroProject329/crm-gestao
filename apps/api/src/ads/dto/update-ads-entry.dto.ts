import {
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateAdsEntryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  businessDate?: string;

  @IsOptional()
  @IsString()
  @Matches(
    /^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/,
    {
      message:
        'amount must be a positive monetary value with at most 2 decimal places.',
    },
  )
  amount?: string;
}