import {
  Controller,
  Get,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary:
      'Check Payment Service health',
  })
  getHealth() {
    return {
      status: 'ok',
      service: 'payment-service',
      timestamp:
        new Date().toISOString(),
    };
  }
}