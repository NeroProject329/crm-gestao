import {
  IsEmail,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  initialPassword!: string;

  @IsInt()
  @Min(0)
  @Max(10_000)
  commissionPercentageBps!: number;

  @Matches(
    /^\d{4}-\d{2}-\d{2}$/,
  )
  commissionEffectiveFrom!: string;
}