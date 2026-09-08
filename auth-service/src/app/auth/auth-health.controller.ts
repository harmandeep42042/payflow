import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

type AuthDatabaseReadiness = {
  checkDatabaseReadiness():
    Promise<boolean>;
};

type AuthRedisReadiness = {
  checkReadiness():
    Promise<boolean>;
};

export const AUTH_HEALTH_DATABASE =
  'AUTH_HEALTH_DATABASE';

export const AUTH_HEALTH_REDIS =
  'AUTH_HEALTH_REDIS';

@ApiTags('Authentication')
@Controller('auth/health')
export class AuthHealthController {
  constructor(
    @Inject(AUTH_HEALTH_DATABASE)
    private readonly database:
      AuthDatabaseReadiness,

    @Inject(AUTH_HEALTH_REDIS)
    private readonly redis:
      AuthRedisReadiness,
  ) {}

  @Get('live')
  @ApiOperation({
    summary:
      'Check Auth Service liveness',
  })
  getLiveness() {
    return {
      status: 'ok',
      service: 'auth-service',
      check: 'liveness',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary:
      'Check Auth Service readiness',
  })
  async getReadiness() {
    const dependencies = {
      database:
        await this.database
          .checkDatabaseReadiness(),

      redis:
        await this.redis
          .checkReadiness(),
    };

    const ready =
      dependencies.database &&
      dependencies.redis;

    const response = {
      status:
        ready
          ? 'ready'
          : 'not_ready',
      service: 'auth-service',
      check: 'readiness',
      dependencies,
      timestamp: new Date().toISOString(),
    };

    if (!ready) {
      throw new ServiceUnavailableException(
        response,
      );
    }

    return response;
  }
}