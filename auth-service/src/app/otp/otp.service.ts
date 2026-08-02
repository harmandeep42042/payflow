import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  randomInt,
} from 'crypto';

import { PrismaService } from '../../../../libs/database/src';
import { RedisService } from '../redis/redis.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class OtpService {
  private readonly otpExpirySeconds = 300;
  private readonly maximumVerifyAttempts = 5;

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const email = this.normalizeEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'No user account was found with this email',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Your account is not active',
      );
    }

    const otp = this.generateOtp();

    const otpKey = this.getOtpKey(email);
    const attemptsKey = this.getAttemptsKey(email);

    await this.redisService.set(
      otpKey,
      this.hashValue(otp),
      this.otpExpirySeconds,
    );

    await this.redisService.delete(attemptsKey);

    return {
      message: 'OTP generated successfully',
      email,
      expiresInSeconds: this.otpExpirySeconds,
      developmentOtp: otp,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = this.normalizeEmail(dto.email);

    const otpKey = this.getOtpKey(email);
    const attemptsKey = this.getAttemptsKey(email);

    const storedOtpHash =
      await this.redisService.get(otpKey);

    if (!storedOtpHash) {
      throw new UnauthorizedException(
        'OTP is invalid or has expired',
      );
    }

    const attempts =
      await this.redisService.increment(
        attemptsKey,
      );

    if (attempts === 1) {
      await this.redisService.expire(
        attemptsKey,
        this.otpExpirySeconds,
      );
    }

    if (attempts > this.maximumVerifyAttempts) {
      await Promise.all([
        this.redisService.delete(otpKey),
        this.redisService.delete(attemptsKey),
      ]);

      throw new HttpException(
        'Maximum OTP verification attempts exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const submittedOtpHash =
      this.hashValue(dto.otp);

    if (submittedOtpHash !== storedOtpHash) {
      throw new UnauthorizedException(
        `Invalid OTP. ${
          this.maximumVerifyAttempts - attempts
        } attempts remaining`,
      );
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User account was not found',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Your account is not active',
      );
    }

    await Promise.all([
      this.redisService.delete(otpKey),
      this.redisService.delete(attemptsKey),
    ]);

    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashValue(
          tokens.refreshToken,
        ),
        expiresAt: this.getRefreshTokenExpiry(),
      },
    });

    return {
      message: 'OTP verified successfully',
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

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
  }) {
    const accessToken =
      await this.jwtService.signAsync(
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

    const refreshToken =
      await this.jwtService.signAsync(
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

  private generateOtp(): string {
    return randomInt(
      100000,
      1000000,
    ).toString();
  }

  private normalizeEmail(
    email: string,
  ): string {
    return email
      .trim()
      .toLowerCase();
  }

  private hashValue(
    value: string,
  ): string {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }

  private getOtpKey(
    email: string,
  ): string {
    return `payflow:otp:${email}`;
  }

  private getAttemptsKey(
    email: string,
  ): string {
    return `payflow:otp-attempts:${email}`;
  }

  private getRefreshTokenExpiry(): Date {
    const expiresAt = new Date();

    expiresAt.setDate(
      expiresAt.getDate() + 7,
    );

    return expiresAt;
  }
}