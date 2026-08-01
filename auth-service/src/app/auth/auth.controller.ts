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
import { Roles } from './decorators/roles.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
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
    summary: 'Health Check',
  })
  health() {
    return this.authService.health();
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register User',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login User',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh JWT Token',
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout User',
  })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Current User Profile',
  })
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: 'Protected profile accessed successfully',
      user,
    };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Admin Dashboard',
  })
  getAdminDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: 'Admin route accessed successfully',
      user,
    };
  }

  @Get('user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'User Dashboard',
  })
  getUserDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      message: 'User route accessed successfully',
      user,
    };
  }
}