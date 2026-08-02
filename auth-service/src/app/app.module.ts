import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { OtpModule } from './otp/otp.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    RedisModule,
    EmailModule,
    AuthModule,
    OtpModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}