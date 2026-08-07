import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type {
  Request,
} from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { RateLimit } from './decorators/rate-limit.decorator';
import { Roles } from './decorators/roles.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
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

  login(
    @Body()
    dto: LoginDto,

    @Req()
    request: Request,
  ) {
    const forwardedFor =
      request.headers[
        'x-forwarded-for'
      ];

    const ipAddress =
      typeof forwardedFor === 'string'
        ? forwardedFor
            .split(',')[0]
            ?.trim()
        : request.ip;

    return this.authService.login(
      dto,
      {
        userAgent:
          request.headers[
            'user-agent'
          ] ?? null,

        ipAddress:
          ipAddress ?? null,
      },
    );
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




  @Post('sessions/current')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Identify the current login session',
  })
  getCurrentSession(
    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: RefreshTokenDto,
  ) {
    return this.authService
      .getCurrentSession(
        user.id,
        dto.refreshToken,
      );
  }
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Get active login sessions',
  })
  getSessions(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.authService
      .getSessions(user.id);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Logout a specific session',
  })
  revokeSession(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param(
      'sessionId',
      new ParseUUIDPipe(),
    )
    sessionId: string,
  ) {
    return this.authService
      .revokeSession(
        user.id,
        sessionId,
      );
  }


  @Post('sessions/logout-others')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Logout every device except the current session',
  })
  logoutOtherSessions(
    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: RefreshTokenDto,
  ) {
    return this.authService
      .logoutOtherSessions(
        user.id,
        dto.refreshToken,
      );
  }
  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Logout all active sessions',
  })
  logoutAllSessions(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.authService
      .logoutAllSessions(
        user.id,
      );
  }
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Change password for the logged-in user',
  })
  changePassword(
    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: ChangePasswordDto,
  ) {
    return this.authService
      .changePassword(
        user.id,
        dto,
      );
  }

  @Post('profile/update')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Update current user profile',
  })
  updateProfile(
    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: UpdateProfileDto,
  ) {
    return this.authService
      .updateProfile(
        user.id,
        dto,
      );
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