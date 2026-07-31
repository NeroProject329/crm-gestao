import {
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SubmitReceiptDto {
  @IsString()
  @Matches(
    /^(?=.*[1-9])\d{1,12}(?:\.\d{1,2})?$/,
    {
      message:
        'amount must be a positive monetary value with at most 2 decimal places.',
    },
  )
  amount!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  payerName!: string;

  @IsISO8601({
    strict: true,
  })
  paidAt!: string;

  @IsString()
  @MinLength(20)
  uploadToken!: string;
}