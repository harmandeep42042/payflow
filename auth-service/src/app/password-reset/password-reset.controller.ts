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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Password Reset')
@Controller('auth/password')
export class PasswordResetController {
  constructor(
    private readonly passwordResetService:
      PasswordResetService,
  ) {}

  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    prefix: 'password-forgot',
    limit: 3,
    windowSeconds: 900,
  })
  @ApiOperation({
    summary:
      'Send password reset instructions',
  })
  @ApiResponse({
    status: 200,
    description:
      'Password reset request processed',
  })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ) {
    return this.passwordResetService
      .forgotPassword(dto);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    prefix: 'password-reset',
    limit: 5,
    windowSeconds: 900,
  })
  @ApiOperation({
    summary:
      'Reset password using email token',
  })
  @ApiResponse({
    status: 200,
    description:
      'Password reset successfully',
  })
  resetPassword(
    @Body() dto: ResetPasswordDto,
  ) {
    return this.passwordResetService
      .resetPassword(dto);
  }
}
