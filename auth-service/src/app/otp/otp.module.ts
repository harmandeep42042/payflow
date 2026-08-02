import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../../../../libs/database/src';
import { RedisRateLimitGuard } from '../auth/guards/redis-rate-limit.guard';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  imports: [
    PrismaModule,

    JwtModule.register({
      secret:
        process.env.JWT_SECRET ??
        'payflow_development_secret_change_me',

      signOptions: {
        expiresIn: '15m',
      },
    }),
  ],

  controllers: [OtpController],

  providers: [
    OtpService,
    RedisRateLimitGuard,
  ],

  exports: [OtpService],
})
export class OtpModule {}
