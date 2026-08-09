import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '@payflow/database';

import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

  async login(
    dto: LoginDto,
    metadata?: {
      userAgent?: string | null;
      ipAddress?: string | null;
    },
  ) {
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
      metadata,
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

          deviceName:
            storedToken.deviceName,

          userAgent:
            storedToken.userAgent,

          ipAddress:
            storedToken.ipAddress,

          lastUsedAt:
            new Date(),

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





  async getCurrentSession(
    userId: string,
    refreshToken: string,
  ) {
    const tokenHash =
      this.hashToken(
        refreshToken.trim(),
      );

    const session =
      await this.prisma.refreshToken
        .findUnique({
          where: {
            tokenHash,
          },

          select: {
            id:
              true,

            userId:
              true,

            deviceName:
              true,

            userAgent:
              true,

            ipAddress:
              true,

            lastUsedAt:
              true,

            expiresAt:
              true,

            revokedAt:
              true,

            createdAt:
              true,
          },
        });

    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException(
        'Current session is invalid or expired',
      );
    }

    return {
      sessionId:
        session.id,

      session: {
        id:
          session.id,

        deviceName:
          session.deviceName,

        userAgent:
          session.userAgent,

        ipAddress:
          session.ipAddress,

        lastUsedAt:
          session.lastUsedAt,

        expiresAt:
          session.expiresAt,

        createdAt:
          session.createdAt,

        isCurrent:
          true,
      },
    };
  }
  async getSessions(
    userId: string,
  ) {
    const now =
      new Date();

    const sessions =
      await this.prisma.refreshToken.findMany({
        where: {
          userId,

          revokedAt:
            null,

          expiresAt: {
            gt:
              now,
          },
        },

        orderBy: {
          lastUsedAt:
            'desc',
        },

        select: {
          id:
            true,

          deviceName:
            true,

          userAgent:
            true,

          ipAddress:
            true,

          lastUsedAt:
            true,

          expiresAt:
            true,

          createdAt:
            true,
        },
      });

    return {
      sessions,

      total:
        sessions.length,
    };
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ) {
    const session =
      await this.prisma.refreshToken.findFirst({
        where: {
          id:
            sessionId,

          userId,
        },
      });

    if (!session) {
      throw new UnauthorizedException(
        'Session was not found',
      );
    }

    if (!session.revokedAt) {
      await this.prisma.refreshToken.update({
        where: {
          id:
            session.id,
        },

        data: {
          revokedAt:
            new Date(),
        },
      });
    }

    return {
      message:
        'Session logged out successfully',

      sessionId:
        session.id,
    };
  }


  async logoutOtherSessions(
    userId: string,
    refreshToken: string,
  ) {
    const tokenHash =
      this.hashToken(
        refreshToken.trim(),
      );

    const currentSession =
      await this.prisma.refreshToken
        .findUnique({
          where: {
            tokenHash,
          },
        });

    if (
      !currentSession ||
      currentSession.userId !== userId ||
      currentSession.revokedAt ||
      currentSession.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException(
        'Current session is invalid or expired',
      );
    }

    const result =
      await this.prisma.refreshToken
        .updateMany({
          where: {
            userId,

            id: {
              not:
                currentSession.id,
            },

            revokedAt:
              null,

            expiresAt: {
              gt:
                new Date(),
            },
          },

          data: {
            revokedAt:
              new Date(),
          },
        });

    await this.prisma.refreshToken
      .update({
        where: {
          id:
            currentSession.id,
        },

        data: {
          lastUsedAt:
            new Date(),
        },
      });

    return {
      message:
        'All other devices logged out successfully',

      currentSessionId:
        currentSession.id,

      revokedCount:
        result.count,
    };
  }
  async logoutAllSessions(
    userId: string,
  ) {
    const result =
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,

          revokedAt:
            null,
        },

        data: {
          revokedAt:
            new Date(),
        },
      });

    return {
      message:
        'All sessions logged out successfully',

      revokedCount:
        result.count,
    };
  }
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (
      !user ||
      user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'User account is unavailable',
      );
    }

    const normalizedPhone =
      dto.phone?.trim();

    if (
      normalizedPhone &&
      normalizedPhone !== user.phone
    ) {
      const existingPhone =
        await this.prisma.user.findUnique({
          where: {
            phone: normalizedPhone,
          },
        });

      if (
        existingPhone &&
        existingPhone.id !== user.id
      ) {
        throw new ConflictException(
          'A user with this phone number already exists',
        );
      }
    }

    const updatedUser =
      await this.prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          ...(dto.firstName !== undefined
            ? {
                firstName:
                  dto.firstName.trim(),
              }
            : {}),

          ...(dto.lastName !== undefined
            ? {
                lastName:
                  dto.lastName.trim(),
              }
            : {}),

          ...(dto.phone !== undefined
            ? {
                phone:
                  normalizedPhone,
              }
            : {}),
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
          updatedAt: true,
        },
      });

    return {
      message:
        'Profile updated successfully',
      user: updatedUser,
    };
  }
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (
      !user ||
      !user.passwordHash ||
      user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'User account is unavailable',
      );
    }

    const currentPasswordMatches =
      await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );

    if (!currentPasswordMatches) {
      throw new UnauthorizedException(
        'Current password is incorrect',
      );
    }

    const sameAsCurrentPassword =
      await bcrypt.compare(
        dto.newPassword,
        user.passwordHash,
      );

    if (sameAsCurrentPassword) {
      throw new ConflictException(
        'New password must be different from the current password',
      );
    }

    const passwordHash =
      await bcrypt.hash(
        dto.newPassword,
        12,
      );

    const now =
      new Date();

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.user.update({
          where: {
            id: user.id,
          },

          data: {
            passwordHash,
          },
        });

        await transaction.refreshToken.updateMany({
          where: {
            userId: user.id,
            revokedAt: null,
          },

          data: {
            revokedAt: now,
          },
        });
      },
    );

    return {
      message:
        'Password changed successfully. Please login again using your new password.',
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
    metadata?: {
      userAgent?: string | null;
      ipAddress?: string | null;
    },
  ) {
    const userAgent =
      metadata?.userAgent?.trim() ||
      null;

    await this.prisma.refreshToken.create({
      data: {
        userId,

        tokenHash:
          this.hashToken(
            refreshToken,
          ),

        deviceName:
          this.detectDeviceName(
            userAgent,
          ),

        userAgent,

        ipAddress:
          metadata?.ipAddress?.trim() ||
          null,

        lastUsedAt:
          new Date(),

        expiresAt:
          this.getRefreshTokenExpiry(),
      },
    });
  }

  private detectDeviceName(
    userAgent: string | null,
  ): string {
    if (!userAgent) {
      return 'Unknown device';
    }

    const value =
      userAgent.toLowerCase();

    let operatingSystem =
      'Unknown OS';

    if (value.includes('windows')) {
      operatingSystem = 'Windows';
    } else if (value.includes('android')) {
      operatingSystem = 'Android';
    } else if (
      value.includes('iphone') ||
      value.includes('ipad')
    ) {
      operatingSystem = 'iPhone/iPad';
    } else if (value.includes('mac os')) {
      operatingSystem = 'macOS';
    } else if (value.includes('linux')) {
      operatingSystem = 'Linux';
    }

    let browser =
      'Unknown Browser';

    if (value.includes('edg/')) {
      browser = 'Microsoft Edge';
    } else if (value.includes('chrome/')) {
      browser = 'Google Chrome';
    } else if (value.includes('firefox/')) {
      browser = 'Mozilla Firefox';
    } else if (value.includes('safari/')) {
      browser = 'Safari';
    }

    return `${browser} on ${operatingSystem}`;
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
