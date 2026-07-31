import {
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateAdsEntryDto {
  @IsUUID()
  employeeId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  businessDate!: string;

  @IsString()
  @Matches(
    /^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/,
    {
      message:
        'amount must be a positive monetary value with at most 2 decimal places.',
    },
  )
  amount!: string;
}