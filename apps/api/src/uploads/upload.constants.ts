export const ALLOWED_RECEIPT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export type ReceiptMimeType =
  (typeof ALLOWED_RECEIPT_MIME_TYPES)[number];

export const MAX_RECEIPT_BYTES =
  10 * 1024 * 1024;

export function extensionForMimeType(
  mimeType: ReceiptMimeType,
): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';

    case 'image/jpeg':
      return 'jpg';

    case 'image/png':
      return 'png';
  }
}