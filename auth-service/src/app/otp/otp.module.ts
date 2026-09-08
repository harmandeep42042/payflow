import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '@payflow/database';
import { RedisRateLimitGuard } from '../auth/guards/redis-rate-limit.guard';
import { SmsModule } from '../sms/sms.module';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

@Module({
  imports: [
    PrismaModule,
    SmsModule,

    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        (() => {
          throw new Error(
            'JWT_SECRET environment variable is required',
          );
        })(),

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
