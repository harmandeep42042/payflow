import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { AuthProxyService } from './auth-proxy.service';

@Controller('auth')
export class AuthProxyController {
  constructor(
    private readonly authProxyService: AuthProxyService,
  ) {}

  @Post('register')
  register(@Body() body: unknown) {
    return this.authProxyService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown) {
    return this.authProxyService.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown) {
    return this.authProxyService.refresh(body);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() body: unknown) {
    return this.authProxyService.logout(body);
  }

  @Get('profile')
  profile(
    @Headers('authorization') authorization?: string,
  ) {
    return this.authProxyService.profile(authorization);
  }
}
