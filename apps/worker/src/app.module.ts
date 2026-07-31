import {
  Module,
} from '@nestjs/common';

import {
  AppService,
} from './app.service';

import {
  DatabaseService,
} from './infra/database.service';

import {
  WorkerConfigService,
} from './infra/worker-config.service';

import {
  QueuesService,
} from './queue/queues.service';

import {
  OutboxStateService,
} from './outbox/outbox-state.service';

import {
  OutboxDispatcherService,
} from './outbox/outbox-dispatcher.service';

import {
  WorkerFinancialRecalculationService,
} from './financial/worker-financial-recalculation.service';

import {
  NotificationService,
} from './notifications/notification.service';

import {
  DomainEventHandler,
} from './domain/domain-event.handler';

import {
  DomainEventWorker,
} from './domain/domain-event.worker';

import {
  PushcutClient,
} from './push/pushcut.client';

import {
  PushWorker,
} from './push/push.worker';

import {
  MaintenanceSchedulerService,
} from './maintenance/maintenance-scheduler.service';

import {
  MaintenanceWorker,
} from './maintenance/maintenance.worker';

import {
  SettlementReconciliationService,
} from './financial/settlement-reconciliation.service';

@Module({
  providers: [
    WorkerConfigService,

    DatabaseService,

    QueuesService,

    OutboxStateService,

    SettlementReconciliationService,

    WorkerFinancialRecalculationService,

    NotificationService,

    DomainEventHandler,

    DomainEventWorker,

    PushcutClient,

    PushWorker,

    MaintenanceSchedulerService,

    MaintenanceWorker,

    OutboxDispatcherService,

    AppService,
  ],
})
export class AppModule {}