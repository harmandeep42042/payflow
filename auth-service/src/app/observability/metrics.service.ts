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
      prefix: 'payflow_auth_runtime_',
    });
  }

  private readonly authOperations =
    new Counter({
      name: 'payflow_auth_operations_total',
      help: 'Total authentication operations',
      labelNames: ['operation', 'outcome'],
      registers: [this.registry],
    });

  private readonly authOperationDuration =
    new Histogram({
      name: 'payflow_auth_operation_duration_seconds',
      help: 'Authentication operation duration in seconds',
      labelNames: ['operation'],
      registers: [this.registry],
    });

  private readonly rateLimitEvents =
    new Counter({
      name: 'payflow_auth_rate_limit_total',
      help: 'Authentication rate limit events',
      labelNames: ['operation', 'outcome'],
      registers: [this.registry],
    });

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  recordAuthOperation(
    operation: string,
    outcome: string,
    durationSeconds?: number,
  ): void {
    try {
      this.authOperations.inc({
        operation,
        outcome,
      });

      if (
        durationSeconds !== undefined &&
        Number.isFinite(durationSeconds) &&
        durationSeconds >= 0
      ) {
        this.authOperationDuration.observe(
          { operation },
          durationSeconds,
        );
      }
    } catch {
      // Telemetry must never break authentication.
    }
  }

  recordRateLimit(
    operation: string,
    outcome: string,
  ): void {
    try {
      this.rateLimitEvents.inc({
        operation,
        outcome,
      });
    } catch {
      // Telemetry must never break authentication.
    }
  }
}
