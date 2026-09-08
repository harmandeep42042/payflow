import { MetricsModule } from './observability/metrics.module';
import { RewardProxyModule } from './reward-proxy/reward-proxy.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

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
import { CustomerFeaturesProxyModule } from './customer-features-proxy/customer-features-proxy.module';

@Module({
  imports: [
    MetricsModule,
    FeatureFlagsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    GatewayAuthModule,
    AuthProxyModule,
    WalletProxyModule,
    PaymentProxyModule,
    RewardProxyModule,
    NotificationProxyModule,
    AdminProxyModule,
    CustomerFeaturesProxyModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}

