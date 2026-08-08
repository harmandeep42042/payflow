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
  PaymentProxyController,
} from './payment-proxy.controller';

import {
  PaymentProxyService,
} from './payment-proxy.service';

@Module({
  imports: [
    GatewayAuthModule,

    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],

  controllers: [
    PaymentProxyController,
  ],

  providers: [
    PaymentProxyService,
  ],
})
export class PaymentProxyModule {}
