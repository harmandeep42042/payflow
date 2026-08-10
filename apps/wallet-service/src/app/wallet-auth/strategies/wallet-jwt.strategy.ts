import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PassportStrategy,
} from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  type?: string;
};

@Injectable()
export class WalletJwtStrategy
  extends PassportStrategy(
    Strategy,
    'wallet-jwt',
  )
{
  constructor() {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey:
        process.env.JWT_SECRET ??
        'payflow_development_secret_change_me',
    });
  }

  validate(payload: JwtPayload) {
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

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
