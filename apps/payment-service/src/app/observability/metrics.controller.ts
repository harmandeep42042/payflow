import {
  Controller,
  Get,
  Header,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  ApiExcludeController,
  ApiOperation,
} from '@nestjs/swagger';

import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Header(
    'Cache-Control',
    'no-store',
  )
  @ApiOperation({
    summary:
      'Expose Payment Service Prometheus metrics',
  })
  async getMetrics(
    @Res({ passthrough: true })
    response: Response,
  ): Promise<string> {
    response.setHeader(
      'Content-Type',
      this.metricsService.getContentType(),
    );

    return this.metricsService.getMetrics();
  }
}