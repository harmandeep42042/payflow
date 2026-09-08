import { RedisService } from '../redis/redis.service';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '@payflow/database';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisRateLimitGuard } from './guards/redis-rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

import {
  AUTH_HEALTH_DATABASE,
  AUTH_HEALTH_REDIS,
  AuthHealthController,
} from './auth-health.controller';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.register({
      global: true,
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

  controllers: [AuthController, AuthHealthController],

  providers: [
    AuthService,
    {
      provide: AUTH_HEALTH_DATABASE,
      useExisting: AuthService,
    },
    {
      provide: AUTH_HEALTH_REDIS,
      useExisting: RedisService,
    },
    JwtStrategy,
    RolesGuard,
    RedisRateLimitGuard,
  ],

  exports: [
    AuthService,
    {
      provide: AUTH_HEALTH_DATABASE,
      useExisting: AuthService,
    },
    {
      provide: AUTH_HEALTH_REDIS,
      useExisting: RedisService,
    },
    JwtModule,
    PassportModule,
    RolesGuard,
    RedisRateLimitGuard,
  ],
})
export class AuthModule {}
