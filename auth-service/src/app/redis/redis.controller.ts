import {
  Controller,
  Get,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RedisService } from './redis.service';

@ApiTags('Redis')
@Controller('redis')
export class RedisController {
  constructor(
    private readonly redisService: RedisService,
  ) {}

  @Get('health')
  @ApiOperation({
    summary: 'Check Redis connection',
  })
  @ApiResponse({
    status: 200,
    description: 'Redis is connected',
  })
  async health() {
    const response =
      await this.redisService.ping();

    return {
      service: 'redis',
      status:
        response === 'PONG'
          ? 'connected'
          : 'unavailable',
      response,
    };
  }

  @Get('test')
  @ApiOperation({
    summary: 'Test Redis read and write',
  })
  async test() {
    const key = 'payflow:redis:test';
    const value = `Redis working at ${new Date().toISOString()}`;

    await this.redisService.set(
      key,
      value,
      60,
    );

    const storedValue =
      await this.redisService.get(key);

    const ttl =
      await this.redisService.ttl(key);

    return {
      key,
      value: storedValue,
      ttlSeconds: ttl,
    };
  }
}
