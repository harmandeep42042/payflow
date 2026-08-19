import {
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
} from '@nestjs/config';

import {
  AdminProxyModule,
} from './admin-proxy/admin-proxy.module';

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
  GatewayAuthModule,
} from './gateway-auth/gateway-auth.module';

import {
  PaymentProxyModule,
} from './payment-proxy/payment-proxy.module';

import {
  NotificationProxyModule,
} from './notification-proxy/notification-proxy.module';

import {
  WalletProxyModule,
} from './wallet-proxy/wallet-proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    GatewayAuthModule,
    AuthProxyModule,
    WalletProxyModule,
    PaymentProxyModule,
    NotificationProxyModule,
    AdminProxyModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}
