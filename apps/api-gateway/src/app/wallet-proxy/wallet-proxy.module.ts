import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { GatewayAuthModule } from '../gateway-auth/gateway-auth.module';
import { WalletProxyController } from './wallet-proxy.controller';
import { WalletProxyService } from './wallet-proxy.service';

@Module({
  imports: [
    GatewayAuthModule,

    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],

  controllers: [
    WalletProxyController,
  ],

  providers: [
    WalletProxyService,
  ],
})
export class WalletProxyModule {}