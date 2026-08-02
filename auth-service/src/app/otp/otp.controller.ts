import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../auth/decorators/rate-limit.decorator';
import { RedisRateLimitGuard } from '../auth/guards/redis-rate-limit.guard';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpService } from './otp.service';

@ApiTags('OTP Authentication')
@Controller('auth/otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    prefix: 'otp-request',
    limit: 3,
    windowSeconds: 300,
  })
  @ApiOperation({
    summary:
      'Generate OTP for an existing user',
  })
  @ApiResponse({
    status: 200,
    description:
      'OTP generated successfully',
  })
  @ApiResponse({
    status: 429,
    description:
      'OTP request limit exceeded',
  })
  requestOtp(
    @Body() dto: RequestOtpDto,
  ) {
    return this.otpService.requestOtp(
      dto,
    );
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    prefix: 'otp-verify',
    limit: 10,
    windowSeconds: 300,
  })
  @ApiOperation({
    summary:
      'Verify OTP and generate JWT tokens',
  })
  @ApiResponse({
    status: 200,
    description:
      'OTP verified successfully',
  })
  @ApiResponse({
    status: 401,
    description:
      'OTP is invalid or expired',
  })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
  ) {
    return this.otpService.verifyOtp(
      dto,
    );
  }
}
