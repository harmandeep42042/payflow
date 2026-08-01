import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthProxyModule } from './auth-proxy/auth-proxy.module';
import { WalletProxyModule } from './wallet-proxy/wallet-proxy.module';

@Module({
  imports: [
    AuthProxyModule,
    WalletProxyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}