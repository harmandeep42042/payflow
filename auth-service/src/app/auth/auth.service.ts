import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../../../../libs/database/src';

import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

type RefreshTokenPayload = {
  sub: string;
  email: string;
  role: string;
  type: 'refresh';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  health() {
    return {
      service: 'auth-service',
      status: 'running',
      message: 'Auth Service is working successfully',
    };
  }

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = dto.phone?.trim();

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email already exists',
      );
    }

    if (normalizedPhone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: {
          phone: normalizedPhone,
        },
      });

      if (existingPhone) {
        throw new ConflictException(
          'A user with this phone number already exists',
        );
      }
    }

    try {
      const passwordHash = await bcrypt.hash(dto.password, 12);

      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim(),
          phone: normalizedPhone,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      return {
        message: 'User registered successfully',
        user,
      };
    } catch {
      throw new InternalServerErrorException(
        'Unable to register user',
      );
    }
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Your account is not active',
      );
    }

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await this.saveRefreshToken(
      user.id,
      tokens.refreshToken,
    );

    return {
      message: 'Login successful',
      tokenType: 'Bearer',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const refreshToken = dto.refreshToken.trim();

    let payload: RefreshTokenPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(
          refreshToken,
          {
            secret:
              process.env.JWT_REFRESH_SECRET ??
              'payflow_refresh_development_secret',
          },
        );
    } catch {
      throw new UnauthorizedException(
        'Refresh token is invalid or expired',
      );
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException(
        'Invalid refresh token type',
      );
    }

    const tokenHash = this.hashToken(refreshToken);

    const storedToken =
      await this.prisma.refreshToken.findUnique({
        where: {
          tokenHash,
        },
      });

    if (!storedToken) {
      throw new UnauthorizedException(
        'Refresh token was not found',
      );
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException(
        'Refresh token has been revoked',
      );
    }

    if (storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Refresh token has expired',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'User account is unavailable',
      );
    }

    const newTokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: {
          id: storedToken.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(
            newTokens.refreshToken,
          ),
          expiresAt: this.getRefreshTokenExpiry(),
        },
      });
    });

    return {
      message: 'Tokens refreshed successfully',
      tokenType: 'Bearer',
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    };
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(
      dto.refreshToken.trim(),
    );

    const storedToken =
      await this.prisma.refreshToken.findUnique({
        where: {
          tokenHash,
        },
      });

    if (!storedToken) {
      return {
        message: 'Logout successful',
      };
    }

    if (!storedToken.revokedAt) {
      await this.prisma.refreshToken.update({
        where: {
          id: storedToken.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return {
      message: 'Logout successful',
    };
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
  }) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret:
          process.env.JWT_SECRET ??
          'payflow_development_secret_change_me',
        expiresIn: '15m',
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'refresh',
      },
      {
        secret:
          process.env.JWT_REFRESH_SECRET ??
          'payflow_refresh_development_secret',
        expiresIn: '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
  ) {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiry(),
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  private getRefreshTokenExpiry(): Date {
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    return expiresAt;
  }
}