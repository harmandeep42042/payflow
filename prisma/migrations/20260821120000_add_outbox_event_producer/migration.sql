-- Add explicit ownership without changing or deleting existing outbox data.
ALTER TABLE "OutboxEvent" ADD COLUMN "producer" TEXT;

-- Backfill the aggregate types already produced by the Wallet and Payment services.
UPDATE "OutboxEvent"
SET "producer" = 'WALLET'
WHERE "aggregateType" IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER');

UPDATE "OutboxEvent"
SET "producer" = 'PAYMENT'
WHERE "aggregateType" = 'PAYMENT';

CREATE INDEX "OutboxEvent_producer_status_createdAt_idx"
ON "OutboxEvent"("producer", "status", "createdAt");
