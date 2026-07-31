export const QUEUE_NAMES = {
  domain:
    'crm-domain-events-v1',

  push:
    'crm-push-deliveries-v1',

  maintenance:
    'crm-maintenance-v1',
} as const;

export const JOB_NAMES = {
  domainEvent:
    'domain-event',

  pushDelivery:
    'push-delivery',

  ensureDailyResults:
    'ensure-daily-results',

  retryPushDeliveries:
    'retry-push-deliveries',
} as const;

export interface OutboxJobData {
  outboxEventId: string;
}

export interface PushJobData {
  pushDeliveryId: string;
}

export type MaintenanceJobData =
  Record<
    string,
    never
  >;