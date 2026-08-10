import {
  Injectable,
} from '@nestjs/common';
import {
  AuthGuard,
} from '@nestjs/passport';

@Injectable()
export class WalletJwtAuthGuard
  extends AuthGuard('wallet-jwt') {}
