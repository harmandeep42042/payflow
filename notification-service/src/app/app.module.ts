import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '@payflow/database';

import { AppController } from './app.controller';

import { AppService } from './app.service';

import { AuthProxyModule } from './auth-proxy/auth-proxy.module';

import { NotificationHistoryController } from './notification-history.controller';

import { NotificationsController } from './notifications.controller';

import { NotificationIdempotencyService } from './notification-idempotency.service';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationPreferencesController } from './notification-preferences.controller';

import { NotificationPreferencesService } from './notification-preferences.service';

import { NotificationJwtAuthGuard } from './notification-auth/notification-jwt-auth.guard';
import { NotificationAdminGuard } from './notification-auth/notification-admin.guard';

import { NotificationDlqService } from './notification-dlq.service';

import { NotificationDlqAdminController } from './notification-dlq-admin.controller';
import { NotificationDlqAdminService } from './notification-dlq-admin.service';
import { MetricsModule } from './observability/metrics.module';
import { HealthController } from './health.controller';
import { NotificationRuntimeHealthState } from './notification-runtime-health-state.service';
@Module({
  imports: [
    MetricsModule,
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        (() => {
          throw new Error('JWT_SECRET environment variable is required');
        })(),
    }),

    PrismaModule,
    AuthProxyModule,
  ],

  controllers: [
    HealthController,
    AppController,
    NotificationsController,
    NotificationHistoryController,
    NotificationPreferencesController,
    NotificationDlqAdminController,
  ],

  providers: [
    NotificationRuntimeHealthState,
    AppService,
    NotificationsService,
    NotificationIdempotencyService,
    NotificationsGateway,
    NotificationJwtAuthGuard,
    NotificationAdminGuard,
    NotificationPreferencesService,
    NotificationDlqService,
    NotificationDlqAdminService,
  ],
})
export class AppModule {}
