import {
  Module,
} from '@nestjs/common';
import {
  PassportModule,
} from '@nestjs/passport';

import {
  WalletJwtAuthGuard,
} from './guards/wallet-jwt-auth.guard';
import {
  WalletJwtStrategy,
} from './strategies/wallet-jwt.strategy';
import {
  WalletRolesGuard,
} from './guards/wallet-roles.guard';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'wallet-jwt',
    }),
  ],

  providers: [
    WalletJwtStrategy,
    WalletJwtAuthGuard,
    WalletRolesGuard,
  ],

  exports: [
    PassportModule,
    WalletJwtAuthGuard,
    WalletRolesGuard,
  ],
})
export class WalletAuthModule {}
