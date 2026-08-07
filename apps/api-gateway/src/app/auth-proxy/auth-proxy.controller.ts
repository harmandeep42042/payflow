import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';

import type {
  Request,
} from 'express';
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

  login(
    @Body()
    body: unknown,

    @Req()
    request: Request,
  ) {
    const forwardedFor =
      request.headers[
        'x-forwarded-for'
      ];

    return this.authProxyService.login(
      body,
      request.headers[
        'user-agent'
      ],
      typeof forwardedFor === 'string'
        ? forwardedFor
        : request.ip,
    );
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


  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body() body: unknown,
  ) {
    return this.authProxyService
      .forgotPassword(body);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body() body: unknown,
  ) {
    return this.authProxyService
      .resetPassword(body);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Headers('authorization')
    authorization: string | undefined,

    @Body()
    body: unknown,
  ) {
    return this.authProxyService
      .changePassword(
        authorization,
        body,
      );
  }

  @Post('profile/update')
  @HttpCode(HttpStatus.OK)
  updateProfile(
    @Headers('authorization')
    authorization: string | undefined,

    @Body()
    body: unknown,
  ) {
    return this.authProxyService
      .updateProfile(
        authorization,
        body,
      );
  }


  @Post('sessions/current')
  @HttpCode(HttpStatus.OK)
  getCurrentSession(
    @Headers('authorization')
    authorization: string | undefined,

    @Body()
    body: {
      refreshToken?: string;
    },
  ) {
    return this.authProxyService
      .getCurrentSession(
        body.refreshToken ?? '',
        authorization,
      );
  }
  @Get('sessions')
  getSessions(
    @Headers('authorization')
    authorization?: string,
  ) {
    return this.authProxyService
      .getSessions(
        authorization,
      );
  }

  @Delete('sessions/:sessionId')
  revokeSession(
    @Param(
      'sessionId',
      new ParseUUIDPipe(),
    )
    sessionId: string,

    @Headers('authorization')
    authorization?: string,
  ) {
    return this.authProxyService
      .revokeSession(
        sessionId,
        authorization,
      );
  }


  @Post('sessions/logout-others')
  @HttpCode(HttpStatus.OK)
  logoutOtherSessions(
    @Headers('authorization')
    authorization: string | undefined,

    @Body()
    body: {
      refreshToken?: string;
    },
  ) {
    return this.authProxyService
      .logoutOtherSessions(
        body.refreshToken ?? '',
        authorization,
      );
  }
  @Delete('sessions')
  logoutAllSessions(
    @Headers('authorization')
    authorization?: string,
  ) {
    return this.authProxyService
      .logoutAllSessions(
        authorization,
      );
  }
  @Get('profile')
  profile(
    @Headers('authorization') authorization?: string,
  ) {
    return this.authProxyService.profile(authorization);
  }
}
