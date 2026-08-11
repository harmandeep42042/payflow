import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  JwtService,
} from '@nestjs/jwt';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  type?: string;
};

export type AuthenticatedNotificationRequest = {
  headers: {
    authorization?: string;
  };

  user?: {
    id: string;
    email: string;
    role: string;
  };
};

@Injectable()
export class NotificationJwtAuthGuard
  implements CanActivate
{
  constructor(
    private readonly jwtService:
      JwtService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedNotificationRequest>();
    const authorization =
      request.headers.authorization;
    const match = authorization?.match(
      /^Bearer\s+(.+)$/i,
    );
    const token = match?.[1]?.trim();

    if (!token) {
      throw new UnauthorizedException(
        'Access token is required',
      );
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<JwtPayload>(
          token,
        );

      if (payload.type === 'refresh') {
        throw new UnauthorizedException(
          'Refresh token cannot be used as an access token',
        );
      }

      if (
        !payload.sub ||
        !payload.email ||
        !payload.role
      ) {
        throw new UnauthorizedException(
          'Invalid access token payload',
        );
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return true;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }
  }
}
