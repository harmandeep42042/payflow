import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  createHash,
  randomInt,
  randomUUID,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

import { PrismaService } from '@payflow/database';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { SmsGatewayHubService } from '../sms/sms-gateway-hub.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestMobileOtpDto } from './dto/request-mobile-otp.dto';
import { VerifyMobileOtpDto } from './dto/verify-mobile-otp.dto';
import { CompleteMobileRegistrationDto } from './dto/complete-mobile-registration.dto';

@Injectable()
export class OtpService {
  private readonly otpExpirySeconds = 300;
  private readonly maximumVerifyAttempts = 5;

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly smsGatewayHubService: SmsGatewayHubService,
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
    const attemptsKey =
      this.getAttemptsKey(email);

    await this.redisService.set(
      otpKey,
      this.hashValue(otp),
      this.otpExpirySeconds,
    );

    await this.redisService.delete(
      attemptsKey,
    );

    try {
      await this.emailService.sendOtpEmail({
        email: user.email,
        firstName: user.firstName,
        otp,
        expiresInMinutes: 5,
      });
    } catch (error) {
      await Promise.all([
        this.redisService.delete(otpKey),
        this.redisService.delete(
          attemptsKey,
        ),
      ]);

      throw error;
    }

    return {
      message:
        'OTP sent successfully to your email',
      email,
      expiresInSeconds:
        this.otpExpirySeconds,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = this.normalizeEmail(dto.email);

    const otpKey = this.getOtpKey(email);
    const attemptsKey =
      this.getAttemptsKey(email);

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
        this.redisService.delete(
          attemptsKey,
        ),
      ]);

      throw new HttpException(
        'Maximum OTP verification attempts exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const submittedOtpHash =
      this.hashValue(dto.otp);

    const otpMatches =
      submittedOtpHash.length === storedOtpHash.length &&
      timingSafeEqual(
        Buffer.from(submittedOtpHash, 'hex'),
        Buffer.from(storedOtpHash, 'hex'),
      );

    if (!otpMatches) {
      throw new UnauthorizedException(
        `Invalid OTP. ${
          this.maximumVerifyAttempts - attempts
        } attempts remaining`,
      );
    }

    const user = await this.prisma.user.findUnique({
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
      this.redisService.delete(
        attemptsKey,
      ),
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
        expiresAt:
          this.getRefreshTokenExpiry(),
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

  async requestMobileOtp(dto: RequestMobileOtpDto) {
    const phone = this.normalizeIndianPhone(dto.phone);


    const cooldownKey =
      this.getMobileOtpCooldownKey(phone);
    const requestWindowKey =
      this.getMobileOtpRequestWindowKey(phone);

    if (await this.redisService.exists(cooldownKey)) {
      throw new HttpException(
        'Please wait before requesting another verification code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const requestLimit =
      await this.redisService.consumeRateLimit(
        requestWindowKey,
        3,
        300,
      );

    if (!requestLimit.allowed) {
      throw new HttpException(
        'Too many verification code requests. Please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.redisService.set(
      cooldownKey,
      '1',
      60,
    );

    const otp = this.generateOtp();

    const otpKey = this.getMobileOtpKey(phone);
    const attemptsKey =
      this.getMobileAttemptsKey(phone);

    await this.redisService.set(
      otpKey,
      this.hashValue(otp),
      this.otpExpirySeconds,
    );

    await this.redisService.delete(
      attemptsKey,
    );

    try {
      await this.smsGatewayHubService.sendOtp(
        phone,
        otp,
      );
    } catch (error) {
      await Promise.all([
        this.redisService.delete(otpKey),
        this.redisService.delete(attemptsKey),
      ]);

      throw error;
    }

    return {
      message: 'Verification code sent successfully',
      expiresInSeconds: this.otpExpirySeconds,
    };
  }

  async verifyMobileOtp(dto: VerifyMobileOtpDto) {
    const phone = this.normalizeIndianPhone(dto.phone);

    const otpKey = this.getMobileOtpKey(phone);
    const attemptsKey =
      this.getMobileAttemptsKey(phone);

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

    const otpMatches =
      submittedOtpHash.length === storedOtpHash.length &&
      timingSafeEqual(
        Buffer.from(submittedOtpHash, 'hex'),
        Buffer.from(storedOtpHash, 'hex'),
      );

    if (!otpMatches) {
      throw new UnauthorizedException(
        'OTP is invalid or has expired',
      );
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          phone,
        },
      });

    await Promise.all([
      this.redisService.delete(otpKey),
      this.redisService.delete(attemptsKey),
    ]);

    if (!user) {
      const registrationToken =
        randomBytes(32).toString('hex');

      const registrationTokenHash =
        this.hashValue(registrationToken);

      const registrationKey =
        this.getMobileRegistrationKey(
          registrationTokenHash,
        );

      await this.redisService.set(
        registrationKey,
        phone,
        600,
      );

      return {
        message: 'Mobile number verified successfully',
        registrationRequired: true,
        registrationToken,
        registrationExpiresInSeconds: 600,
      };
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

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashValue(
          tokens.refreshToken,
        ),
        expiresAt:
          this.getRefreshTokenExpiry(),
      },
    });

    return {
      message: 'OTP verified successfully',
      registrationRequired: false,
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

  async completeMobileRegistration(
    dto: CompleteMobileRegistrationDto,
  ) {
    const registrationTokenHash =
      this.hashValue(dto.registrationToken);

    const registrationKey =
      this.getMobileRegistrationKey(
        registrationTokenHash,
      );

    const phone =
      await this.redisService.get(registrationKey);

    if (!phone) {
      throw new UnauthorizedException(
        'Registration session is invalid or has expired',
      );
    }

    const email =
      this.normalizeEmail(dto.email);

    const existingPhone =
      await this.prisma.user.findUnique({
        where: {
          phone,
        },
      });

    if (existingPhone) {
      await this.redisService.delete(
        registrationKey,
      );

      throw new ConflictException(
        'An account with this mobile number already exists',
      );
    }

    const existingEmail =
      await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (existingEmail) {
      throw new ConflictException(
        'A user with this email already exists',
      );
    }

    const passwordHash =
      await bcrypt.hash(dto.password, 12);

    const consumedPhone =
      await this.redisService.getAndDelete(
        registrationKey,
      );

    if (!consumedPhone || consumedPhone !== phone) {
      throw new UnauthorizedException(
        'Registration session is invalid or has expired',
      );
    }

    let result;

    try {
      result =
        await this.prisma.$transaction(
        async (tx) => {
          const user =
            await tx.user.create({
              data: {
                email,
                phone,
                firstName:
                  dto.firstName.trim(),
                lastName:
                  dto.lastName?.trim(),
                passwordHash,
              },
            });

          const tokens =
            await this.generateTokens({
              id: user.id,
              email: user.email,
              role: user.role,
            });

          await tx.refreshToken.create({
            data: {
              userId: user.id,
              tokenHash:
                this.hashValue(
                  tokens.refreshToken,
                ),
              expiresAt:
                this.getRefreshTokenExpiry(),
            },
          });

          return {
            user,
            tokens,
          };
        },
      );

    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email or mobile number already exists',
        );
      }

      throw error;
    }

    return {
      message:
        'Mobile account registered successfully',
      registrationRequired: false,
      tokenType: 'Bearer',
      accessToken:
        result.tokens.accessToken,
      refreshToken:
        result.tokens.refreshToken,
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      user: {
        id: result.user.id,
        email: result.user.email,
        phone: result.user.phone,
        firstName:
          result.user.firstName,
        lastName:
          result.user.lastName,
        role: result.user.role,
        status: result.user.status,
      },
    };
  }
  private normalizeIndianPhone(value: string): string {
    const compact = value.trim().replace(/[\s-]/g, '');

    if (/^[6-9][0-9]{9}$/.test(compact)) {
      return `+91${compact}`;
    }

    if (/^91[6-9][0-9]{9}$/.test(compact)) {
      return `+${compact}`;
    }

    if (/^\+91[6-9][0-9]{9}$/.test(compact)) {
      return compact;
    }

    throw new UnauthorizedException(
      'Invalid mobile number',
    );
  }

  private getMobileOtpKey(phone: string): string {
    return `auth:otp:mobile:${this.hashValue(phone)}`;
  }

  private getMobileOtpCooldownKey(phone: string): string {
    return `auth:otp:mobile:cooldown:${this.hashValue(phone)}`;
  }

  private getMobileOtpRequestWindowKey(phone: string): string {
    return `auth:otp:mobile:requests:${this.hashValue(phone)}`;
  }

  private getMobileRegistrationKey(
    registrationTokenHash: string,
  ): string {
    return `auth:otp:mobile:registration:${registrationTokenHash}`;
  }
  private getMobileAttemptsKey(phone: string): string {
    return `auth:otp:mobile:attempts:${this.hashValue(phone)}`;
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
            process.env.JWT_SECRET ||
          (() => {
            throw new Error(
              'JWT_SECRET environment variable is required',
            );
          })(),
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
          jti: randomUUID(),
        },
        {
          secret:
            process.env.JWT_REFRESH_SECRET ||
              (() => {
                throw new Error(
                  'JWT_REFRESH_SECRET environment variable is required',
                );
              })(),
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
