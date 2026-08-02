import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  createHash,
  randomBytes,
} from 'crypto';

import { PrismaService } from '../../../../libs/database/src';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class PasswordResetService {
  private readonly tokenExpirySeconds = 900;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();

    const genericResponse = {
      message:
        'If an active account exists for this email, password reset instructions have been sent.',
    };

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return genericResponse;
    }

    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashValue(resetToken);
    const redisKey = this.getResetTokenKey(tokenHash);

    await this.redisService.set(
      redisKey,
      user.id,
      this.tokenExpirySeconds,
    );

    try {
      const deliveryResult =
        await this.emailService.sendResetPasswordEmail({
          email: user.email,
          firstName: user.firstName,
          resetToken,
        });

      if (
        deliveryResult.delivery === 'console' &&
        process.env.NODE_ENV !== 'production'
      ) {
        return {
          ...genericResponse,
          developmentResetToken: resetToken,
          expiresInSeconds: this.tokenExpirySeconds,
        };
      }

      return genericResponse;
    } catch (error) {
      await this.redisService.delete(redisKey);
      throw error;
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashValue(dto.token.trim());
    const redisKey = this.getResetTokenKey(tokenHash);

    const userId = await this.redisService.get(redisKey);

    if (!userId) {
      throw new UnauthorizedException(
        'Password reset token is invalid or has expired',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      await this.redisService.delete(redisKey);

      throw new UnauthorizedException(
        'Password reset token is invalid or has expired',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      12,
    );

    const now = new Date();

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

    await this.redisService.delete(redisKey);

    return {
      message:
        'Password reset successfully. Please login using your new password.',
    };
  }

  private hashValue(value: string): string {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }

  private getResetTokenKey(tokenHash: string): string {
    return `payflow:password-reset:${tokenHash}`;
  }
}