import {
  IsIn,
  IsInt,
  Max,
  Min,
} from 'class-validator';

import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_BYTES,
} from '../upload.constants';

export class InitReceiptUploadDto {
  @IsIn(
    ALLOWED_RECEIPT_MIME_TYPES,
  )
  mimeType!:
    | 'application/pdf'
    | 'image/jpeg'
    | 'image/png';

  @IsInt()
  @Min(1)
  @Max(MAX_RECEIPT_BYTES)
  sizeBytes!: number;
}