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

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'wallet-jwt',
    }),
  ],

  providers: [
    WalletJwtStrategy,
    WalletJwtAuthGuard,
  ],

  exports: [
    PassportModule,
    WalletJwtAuthGuard,
  ],
})
export class WalletAuthModule {}
