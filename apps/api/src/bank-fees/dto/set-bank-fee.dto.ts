import {
  IsInt,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class SetBankFeeDto {
  @IsInt()
  @Min(0)
  @Max(10_000)
  percentageBps!: number;

  @Matches(
    /^\d{4}-\d{2}-\d{2}$/,
  )
  effectiveFrom!: string;
}