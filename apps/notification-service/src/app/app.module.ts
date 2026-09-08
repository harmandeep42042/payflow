import { NotificationRuntimeHealthState } from './notification-runtime-health-state.service';
import { HealthController } from './health.controller';
import {
  Module,
} from '@nestjs/common';

import {
  PrismaModule,
} from '@payflow/database';

import {
  EmailModule,
} from './email/email.module';

import {
  NotificationsController,
} from './notifications.controller';

import {
  NotificationsGateway,
} from './notifications.gateway';

import {
  NotificationIdempotencyService,
} from './notification-idempotency.service';

import {
  MetricsModule,
} from './observability/metrics.module';

@Module({
  imports: [
    MetricsModule,
    PrismaModule,
    EmailModule,
  ],

  controllers: [
    HealthController,
    NotificationsController,
  ],

  providers: [
    NotificationRuntimeHealthState,
    NotificationsGateway,
    NotificationIdempotencyService,
  ],
})
export class AppModule {}