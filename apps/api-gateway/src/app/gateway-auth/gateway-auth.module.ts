import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  PassportModule,
} from '@nestjs/passport';

import {
  GatewayJwtAuthGuard,
} from './guards/gateway-jwt-auth.guard';
import {
  GatewayJwtStrategy,
} from './strategies/gateway-jwt.strategy';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        (() => {
          throw new Error(
            'JWT_SECRET environment variable is required',
          );
        })(),
    }),
  ],

  providers: [
    GatewayJwtStrategy,
    GatewayJwtAuthGuard,
  ],

  exports: [
    PassportModule,
    JwtModule,
    GatewayJwtAuthGuard,
  ],
})
export class GatewayAuthModule {}
