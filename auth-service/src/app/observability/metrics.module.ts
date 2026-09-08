import {
  Global,
  Module,
} from '@nestjs/common';

import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthOperationMetricsInterceptor } from './auth-operation-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [
    MetricsController,
  ],
  providers: [
    MetricsService,
    AuthOperationMetricsInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting:
        AuthOperationMetricsInterceptor,
    },
  ],
  exports: [
    MetricsService,
  ],
})
export class MetricsModule {}