import {
  Controller,
  Get,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  Public,
} from './gateway-auth/decorators/public.decorator';
import { AppService } from './app.service';

@ApiTags('Gateway')
@Controller()
export class AppController {
  constructor(
    private readonly appService:
      AppService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary:
      'Check API Gateway health',
  })
  getHealth() {
    return this.appService.getHealth();
  }
}