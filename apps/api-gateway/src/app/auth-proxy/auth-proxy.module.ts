import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { AuthProxyController } from './auth-proxy.controller';
import { AuthProxyService } from './auth-proxy.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],
  controllers: [AuthProxyController],
  providers: [AuthProxyService],
})
export class AuthProxyModule {}
