import {
  Injectable
} from '@nestjs/common';

import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from '@prometheus-io/client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  constructor() {
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'payflow_gateway_runtime_',
    });
  }

  private readonly httpRequests =
    new Counter({
      name: 'payflow_gateway_http_requests_total',
      help: 'Total API Gateway HTTP requests',
      labelNames: [
        'method',
        'route',
        'status_class',
      ],
      registers: [this.registry],
    });

  private readonly httpDuration =
    new Histogram({
      name: 'payflow_gateway_http_request_duration_seconds',
      help: 'API Gateway HTTP request duration in seconds',
      labelNames: [
        'method',
        'route',
      ],
      registers: [this.registry],
    });

  private readonly featureFlagEvaluations =
    new Counter({
      name: 'payflow_gateway_feature_flag_evaluations_total',
      help: 'Feature flag evaluations performed by the API Gateway',
      labelNames: ['flag', 'result', 'source'],
      registers: [this.registry],
    });

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusClass: string,
    durationSeconds?: number,
  ): void {
    try {
      this.httpRequests.inc({
        method,
        route,
        status_class: statusClass,
      });

      if (
        durationSeconds !== undefined &&
        Number.isFinite(durationSeconds) &&
        durationSeconds >= 0
      ) {
        this.httpDuration.observe(
          {
            method,
            route,
          },
          durationSeconds,
        );
      }
    } catch {
      // Telemetry must never break Gateway traffic.
    }
  }

  recordFeatureFlagEvaluation(
    flag: string,
    result: 'enabled' | 'disabled',
    source: 'redis' | 'default',
  ): void {
    try {
      this.featureFlagEvaluations.inc({ flag, result, source });
    } catch {
      // Telemetry must never break Gateway traffic.
    }
  }
}
