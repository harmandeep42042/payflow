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

  readonly notificationEventsTotal: Counter<
    'event' | 'outcome'
  >;

  readonly notificationDeliveryTotal: Counter<
    'channel' | 'outcome'
  >;

  readonly notificationDeliveryDurationSeconds: Histogram<
    'channel'
  >;

  readonly notificationIdempotencyTotal: Counter<
    'outcome'
  >;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'payflow_notification_runtime_',
    });

    this.notificationEventsTotal =
      new Counter({
        name:
          'payflow_notification_events_total',

        help:
          'Total number of notification events processed.',

        labelNames: [
          'event',
          'outcome',
        ],

        registers: [
          this.registry,
        ],
      });

    this.notificationDeliveryTotal =
      new Counter({
        name:
          'payflow_notification_delivery_total',

        help:
          'Total number of notification delivery attempts.',

        labelNames: [
          'channel',
          'outcome',
        ],

        registers: [
          this.registry,
        ],
      });

    this.notificationDeliveryDurationSeconds =
      new Histogram({
        name:
          'payflow_notification_delivery_duration_seconds',

        help:
          'Duration of notification delivery operations in seconds.',

        labelNames: [
          'channel',
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

    this.notificationIdempotencyTotal =
      new Counter({
        name:
          'payflow_notification_idempotency_total',

        help:
          'Total number of notification idempotency outcomes.',

        labelNames: [
          'outcome',
        ],

        registers: [
          this.registry,
        ],
      });
  }

  recordNotificationEvent(
    event: string,
    outcome: string,
  ): void {
    try {
      this.notificationEventsTotal
        .labels(
          event,
          outcome,
        )
        .inc();
    } catch {
      /*
       * Metrics are telemetry only.
       * They must never affect notification processing.
       */
    }
  }

  recordDelivery(
    channel: string,
    outcome: string,
    durationSeconds?: number,
  ): void {
    try {
      this.notificationDeliveryTotal
        .labels(
          channel,
          outcome,
        )
        .inc();

      if (
        typeof durationSeconds === 'number' &&
        Number.isFinite(durationSeconds) &&
        durationSeconds >= 0
      ) {
        this.notificationDeliveryDurationSeconds
          .labels(channel)
          .observe(durationSeconds);
      }
    } catch {
      /*
       * Delivery telemetry must never alter delivery semantics.
       */
    }
  }

  recordIdempotency(
    outcome: string,
  ): void {
    try {
      this.notificationIdempotencyTotal
        .labels(outcome)
        .inc();
    } catch {
      /*
       * Idempotency behavior must not depend on metrics.
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
