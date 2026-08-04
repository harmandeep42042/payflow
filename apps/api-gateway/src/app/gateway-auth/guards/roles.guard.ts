import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import {
  GatewayRole,
  ROLES_KEY,
} from '../decorators/roles.decorator';

type AuthenticatedGatewayUser = {
  id: string;
  email: string;
  role: GatewayRole;
};

type AuthenticatedRequest = Request & {
  user?: AuthenticatedGatewayUser;
};

@Injectable()
export class RolesGuard
  implements CanActivate
{
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const requiredRoles =
      this.reflector
        .getAllAndOverride<
          GatewayRole[]
        >(
          ROLES_KEY,
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

    const request =
      context
        .switchToHttp()
        .getRequest<
          AuthenticatedRequest
        >();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Authenticated user information is missing',
      );
    }

    if (
      !requiredRoles.includes(
        user.role,
      )
    ) {
      throw new ForbiddenException(
        'Administrator access is required',
      );
    }

    return true;
  }
}