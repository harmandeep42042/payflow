import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GatewayAuthModule } from '../gateway-auth/gateway-auth.module';
import { RewardProxyController } from './reward-proxy.controller';
import { RewardProxyService } from './reward-proxy.service';

@Module({
  imports: [GatewayAuthModule, HttpModule.register({ timeout: 5000, maxRedirects: 0 })],
  controllers: [RewardProxyController],
  providers: [RewardProxyService],
})
export class RewardProxyModule {}
