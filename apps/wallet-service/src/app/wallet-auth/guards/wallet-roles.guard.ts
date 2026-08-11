import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Reflector,
} from '@nestjs/core';

import {
  WalletRole,
  WALLET_ROLES_KEY,
} from '../decorators/wallet-roles.decorator';

type AuthenticatedWalletRequest = {
  user?: {
    id: string;
    email: string;
    role: WalletRole;
  };
};

@Injectable()
export class WalletRolesGuard
  implements CanActivate
{
  constructor(
    private readonly reflector:
      Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const requiredRoles =
      this.reflector
        .getAllAndOverride<
          WalletRole[]
        >(
          WALLET_ROLES_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    if (
      !requiredRoles ||
      requiredRoles.length === 0
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedWalletRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Authenticated user information is missing',
      );
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Administrator access is required',
      );
    }

    return true;
  }
}
