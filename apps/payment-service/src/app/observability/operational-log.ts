export type OperationalLogLevel = 'log' | 'warn' | 'error' | 'debug';

export type OperationalLogFields = {
  correlationId?: string;
  paymentId?: string;
  webhookEventId?: string;
  providerEventId?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  eventId?: string;
  attempts?: number;
  status?: string;
  outcome?: string;
  reason?: string;
  queue?: string;
};

export type OperationalLogRecord = OperationalLogFields & {
  event: string;
};

const MAX_EVENT_LENGTH = 128;
const MAX_TEXT_FIELD_LENGTH = 256;

function cleanString(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/[\r\n\t]/g, ' ').trim();

  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.slice(0, maxLength);
}

function cleanAttempts(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

export function createOperationalLog(
  event: string,
  fields: OperationalLogFields = {},
): OperationalLogRecord {
  const normalizedEvent = cleanString(event, MAX_EVENT_LENGTH);

  if (!normalizedEvent) {
    throw new Error('Operational log event is required.');
  }

  const record: OperationalLogRecord = {
    event: normalizedEvent,
  };

  const correlationId = cleanString(
    fields.correlationId,
    MAX_TEXT_FIELD_LENGTH,
  );

  const paymentId = cleanString(fields.paymentId, MAX_TEXT_FIELD_LENGTH);

  const webhookEventId = cleanString(
    fields.webhookEventId,
    MAX_TEXT_FIELD_LENGTH,
  );

  const providerEventId = cleanString(
    fields.providerEventId,
    MAX_TEXT_FIELD_LENGTH,
  );

  const providerOrderId = cleanString(
    fields.providerOrderId,
    MAX_TEXT_FIELD_LENGTH,
  );

  const providerPaymentId = cleanString(
    fields.providerPaymentId,
    MAX_TEXT_FIELD_LENGTH,
  );

  const eventId = cleanString(fields.eventId, MAX_TEXT_FIELD_LENGTH);

  const status = cleanString(fields.status, MAX_TEXT_FIELD_LENGTH);

  const outcome = cleanString(fields.outcome, MAX_TEXT_FIELD_LENGTH);

  const reason = cleanString(fields.reason, MAX_TEXT_FIELD_LENGTH);

  const queue = cleanString(fields.queue, MAX_TEXT_FIELD_LENGTH);

  const attempts = cleanAttempts(fields.attempts);

  if (correlationId) {
    record.correlationId = correlationId;
  }

  if (paymentId) {
    record.paymentId = paymentId;
  }

  if (webhookEventId) {
    record.webhookEventId = webhookEventId;
  }

  if (providerEventId) {
    record.providerEventId = providerEventId;
  }

  if (providerOrderId) {
    record.providerOrderId = providerOrderId;
  }

  if (providerPaymentId) {
    record.providerPaymentId = providerPaymentId;
  }

  if (eventId) {
    record.eventId = eventId;
  }

  if (attempts !== undefined) {
    record.attempts = attempts;
  }

  if (status) {
    record.status = status;
  }

  if (outcome) {
    record.outcome = outcome;
  }

  if (reason) {
    record.reason = reason;
  }

  if (queue) {
    record.queue = queue;
  }

  return record;
}

export function serializeOperationalLog(
  event: string,
  fields: OperationalLogFields = {},
): string {
  return JSON.stringify(createOperationalLog(event, fields));
}
