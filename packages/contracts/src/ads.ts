export type AdsEntryViewStatus =
  | 'ACTIVE'
  | 'CANCELED';

export type RecalculationTriggerStatus =
  | 'COMPLETED'
  | 'PENDING';

export interface AdsEntryView {
  id: string;

  companyId: string;
  employeeId: string;

  businessDate: string;
  amount: string;

  status: AdsEntryViewStatus;

  canceledAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface AdsMutationResponse {
  adsEntry: AdsEntryView;

  recalculation: {
    status: RecalculationTriggerStatus;
    effectiveFrom: string;
  };
}