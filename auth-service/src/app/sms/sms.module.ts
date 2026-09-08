import { Module } from '@nestjs/common';
import { SmsGatewayHubService } from './sms-gateway-hub.service';

@Module({
  providers: [SmsGatewayHubService],
  exports: [SmsGatewayHubService],
})
export class SmsModule {}