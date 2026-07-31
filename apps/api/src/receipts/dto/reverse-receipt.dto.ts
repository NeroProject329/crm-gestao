import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReverseReceiptDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}