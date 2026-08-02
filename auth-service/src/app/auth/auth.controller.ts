import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RateLimit } from './decorators/rate-limit.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RedisRateLimitGuard } from './guards/redis-rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';

type AuthenticatedUser = {
  id: string;
  email: string;
  role: string;
};

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Get('health')
  @ApiOperation({
    summary: 'Check Auth Service health',
  })
  health() {
    return this.authService.health();
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    prefix: 'register',
    limit: 3,
    windowSeconds: 300,
  })
  @ApiOperation({
    summary: 'Register a new user',
  })
  @ApiResponse({
    status: 201,
    description:
      'User registered successfully',
  })
  @ApiResponse({
    status: 429,
    description:
      'Registration rate limit exceeded',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    prefix: 'login',
    limit: 5,
    windowSeconds: 300,
  })
  @ApiOperation({
    summary: 'Login using email and password',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
  })
  @ApiResponse({
    status: 429,
    description:
      'Login rate limit exceeded',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    prefix: 'refresh',
    limit: 10,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Rotate refresh token',
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({
    prefix: 'logout',
    limit: 10,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Revoke refresh token',
  })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user profile',
  })
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message:
        'Protected profile accessed successfully',
      user,
    };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Access ADMIN-only route',
  })
  getAdminDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message:
        'Admin route accessed successfully',
      user,
    };
  }

  @Get('user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Access USER or ADMIN route',
  })
  getUserDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message:
        'User route accessed successfully',
      user,
    };
  }
}