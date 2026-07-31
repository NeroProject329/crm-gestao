export type ReceiptStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELED'
  | 'REVERSED';

export interface ReceiptUploadInitResponse {
  uploadUrl: string;

  uploadToken: string;

  method: 'PUT';

  headers: {
    'Content-Type': string;
  };

  expiresInSeconds: number;
}

export interface ReceiptFileView {
  mimeType: string;
  sizeBytes: number;
}

export interface EmployeeReceiptView {
  id: string;

  amount: string;
  payerName: string;

  paidAt: string;
  businessDate: string;

  status: ReceiptStatus;

  file: ReceiptFileView;

  createdAt: string;
  updatedAt: string;
}

export interface AdminReceiptView
  extends EmployeeReceiptView {
  companyId: string;
  employeeId: string;

  reviewedByUserId:
    | string
    | null;

  reviewedAt:
    | string
    | null;

  reviewNote:
    | string
    | null;

  reversedByUserId:
    | string
    | null;

  reversedAt:
    | string
    | null;

  reversalReason:
    | string
    | null;
}

export interface ReceiptFileUrlResponse {
  url: string;
  expiresInSeconds: number;
}

export interface ReceiptRecalculationView {
  status:
    | 'COMPLETED'
    | 'PENDING';

  effectiveFrom: string;
}

export interface AdminReceiptActionResponse {
  receipt: AdminReceiptView;

  recalculation:
    | ReceiptRecalculationView
    | null;
}