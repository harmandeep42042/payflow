import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import {
  GatewayAuthModule,
} from '../gateway-auth/gateway-auth.module';
import {
  RolesGuard,
} from '../gateway-auth/guards/roles.guard';
import {
  AdminProxyController,
} from './admin-proxy.controller';
import {
  AdminProxyService,
} from './admin-proxy.service';

@Module({
  imports: [
    GatewayAuthModule,

    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],

  controllers: [
    AdminProxyController,
  ],

  providers: [
    AdminProxyService,
    RolesGuard,
  ],
})
export class AdminProxyModule {}