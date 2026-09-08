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

  readonly walletOperationsTotal: Counter<
    'operation' | 'outcome'
  >;

  readonly walletOperationDurationSeconds: Histogram<
    'operation'
  >;

  readonly walletRecoveryEventsTotal: Counter<
    'event' | 'outcome'
  >;

  constructor() {
    this.registry =
      new Registry();
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'payflow_wallet_runtime_',
    });

    this.walletOperationsTotal =
      new Counter({
        name:
          'payflow_wallet_operations_total',

        help:
          'Total number of Wallet Service operations.',

        labelNames: [
          'operation',
          'outcome',
        ],

        registers: [
          this.registry,
        ],
      });

    this.walletOperationDurationSeconds =
      new Histogram({
        name:
          'payflow_wallet_operation_duration_seconds',

        help:
          'Duration of Wallet Service operations in seconds.',

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

    this.walletRecoveryEventsTotal =
      new Counter({
        name:
          'payflow_wallet_recovery_events_total',

        help:
          'Total number of Wallet Service recovery events.',

        labelNames: [
          'event',
          'outcome',
        ],

        registers: [
          this.registry,
        ],
      });
  }

  recordWalletOperation(
    operation: string,
    outcome: string,
    durationSeconds?: number,
  ): void {
    try {
      this.walletOperationsTotal
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
        this.walletOperationDurationSeconds
          .labels(operation)
          .observe(durationSeconds);
      }
    } catch {
      /*
       * Metrics are telemetry only.
       * Wallet business semantics must never
       * depend on metrics collection.
       */
    }
  }

  recordRecoveryEvent(
    event: string,
    outcome: string,
  ): void {
    try {
      this.walletRecoveryEventsTotal
        .labels(
          event,
          outcome,
        )
        .inc();
    } catch {
      /*
       * Recovery behavior must never
       * depend on telemetry.
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
