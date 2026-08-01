import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthProxyModule } from './auth-proxy/auth-proxy.module';

@Module({
  imports: [AuthProxyModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}