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
export class PaymentJwtStrategy
  extends PassportStrategy(
    Strategy,
    'payment-jwt',
  )
{
  constructor() {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey:
        process.env.JWT_SECRET ||
        (() => {
          throw new Error(
            'JWT_SECRET environment variable is required',
          );
        })(),
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
