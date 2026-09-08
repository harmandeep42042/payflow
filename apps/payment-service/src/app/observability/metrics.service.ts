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
  readonly registry: Registry;

  readonly paymentOperationsTotal: Counter<
    'operation' | 'outcome'
  >;

  readonly paymentOperationDurationSeconds: Histogram<
    'operation'
  >;

  readonly paymentWebhookEventsTotal: Counter<
    'event' | 'outcome'
  >;

  readonly paymentRecoveryEventsTotal: Counter<
    'event' | 'outcome'
  >;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'payflow_payment_runtime_',
    });

    this.paymentOperationsTotal =
      new Counter({
        name: 'payflow_payment_operations_total',
        help: 'Total number of payment operations.',
        labelNames: [
          'operation',
          'outcome',
        ],
        registers: [
          this.registry,
        ],
      });

    this.paymentOperationDurationSeconds =
      new Histogram({
        name: 'payflow_payment_operation_duration_seconds',
        help: 'Duration of payment operations in seconds.',
        labelNames: [
          'operation',
        ],
        registers: [
          this.registry,
        ],
        buckets: [
          0.005,
          0.01,
          0.025,
          0.05,
          0.1,
          0.25,
          0.5,
          1,
          2.5,
          5,
          10,
        ],
      });

    this.paymentWebhookEventsTotal =
      new Counter({
        name: 'payflow_payment_webhook_events_total',
        help: 'Total number of payment webhook events processed.',
        labelNames: [
          'event',
          'outcome',
        ],
        registers: [
          this.registry,
        ],
      });

    this.paymentRecoveryEventsTotal =
      new Counter({
        name: 'payflow_payment_recovery_events_total',
        help: 'Total number of payment recovery events processed.',
        labelNames: [
          'event',
          'outcome',
        ],
        registers: [
          this.registry,
        ],
      });
  }

  recordPaymentOperation(
    operation: string,
    outcome: string,
    durationSeconds?: number,
  ): void {
    try {
      this.paymentOperationsTotal
        .labels(
          operation,
          outcome,
        )
        .inc();

      if (
        typeof durationSeconds === 'number' &&
        Number.isFinite(durationSeconds) &&
        durationSeconds >= 0
      ) {
        this.paymentOperationDurationSeconds
          .labels(operation)
          .observe(durationSeconds);
      }
    } catch {
      /*
       * Metrics are operational telemetry only.
       * Instrumentation must never affect payment execution.
       */
    }
  }

  recordWebhookEvent(
    event: string,
    outcome: string,
  ): void {
    try {
      this.paymentWebhookEventsTotal
        .labels(
          event,
          outcome,
        )
        .inc();
    } catch {
      /*
       * Metrics must never alter webhook semantics.
       */
    }
  }

  recordRecoveryEvent(
    event: string,
    outcome: string,
  ): void {
    try {
      this.paymentRecoveryEventsTotal
        .labels(
          event,
          outcome,
        )
        .inc();
    } catch {
      /*
       * Metrics must never alter reconciliation semantics.
       */
    }
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
