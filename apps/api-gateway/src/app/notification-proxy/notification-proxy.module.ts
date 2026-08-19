import {
  HttpModule,
} from '@nestjs/axios';

import {
  Module,
} from '@nestjs/common';

import {
  GatewayAuthModule,
} from '../gateway-auth/gateway-auth.module';

import {
  NotificationProxyController,
} from './notification-proxy.controller';

import {
  NotificationProxyService,
} from './notification-proxy.service';

@Module({
  imports: [
    GatewayAuthModule,

    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],

  controllers: [
    NotificationProxyController,
  ],

  providers: [
    NotificationProxyService,
  ],
})
export class NotificationProxyModule {}
