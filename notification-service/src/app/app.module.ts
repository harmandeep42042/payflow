import {
  Module,
} from '@nestjs/common';

import {
  JwtModule,
} from '@nestjs/jwt';

import {
  PrismaModule,
} from '@payflow/database';

import {
  AppController,
} from './app.controller';

import {
  AppService,
} from './app.service';

import {
  AuthProxyModule,
} from './auth-proxy/auth-proxy.module';

import {
  NotificationHistoryController,
} from './notification-history.controller';

import {
  NotificationsController,
} from './notifications.controller';

import {
  NotificationsService,
} from './notifications.service';
import {
  NotificationsGateway,
} from './notifications.gateway';
import {
  NotificationPreferencesController,
} from './notification-preferences.controller';

import {
  NotificationPreferencesService,
} from './notification-preferences.service';

import {
  NotificationJwtAuthGuard,
} from './notification-auth/notification-jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        (() => {
          throw new Error(
            'JWT_SECRET environment variable is required',
          );
        })(),
    }),

    PrismaModule,
    AuthProxyModule,
  ],

  controllers: [
    AppController,
    NotificationsController,
    NotificationHistoryController,
NotificationPreferencesController,
  ],

  providers: [
    AppService,
    NotificationsService,
    NotificationsGateway,
    NotificationJwtAuthGuard,
NotificationPreferencesService,
  ],
})
export class AppModule {}
