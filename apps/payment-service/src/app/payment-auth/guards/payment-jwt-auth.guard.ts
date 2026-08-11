import {
  Injectable,
} from '@nestjs/common';
import {
  AuthGuard,
} from '@nestjs/passport';

@Injectable()
export class PaymentJwtAuthGuard
  extends AuthGuard('payment-jwt') {}
