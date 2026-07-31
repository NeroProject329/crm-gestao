import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RejectReceiptDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}