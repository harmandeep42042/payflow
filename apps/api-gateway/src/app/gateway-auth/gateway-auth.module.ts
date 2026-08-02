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
        process.env.JWT_SECRET ??
        'payflow_development_secret_change_me',
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
