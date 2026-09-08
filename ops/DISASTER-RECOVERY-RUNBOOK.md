# Payflow Disaster Recovery & Incident Runbook

## 1. Purpose

This runbook defines the controlled recovery procedure for the current Payflow production architecture.

It covers:

- PostgreSQL
- Redis
- RabbitMQ
- application services
- outbox processing
- financial integrity
- external provider / UPI reconciliation

This runbook does not authorize destructive recovery automatically.

## 2. Recovery authority hierarchy

Financial truth:

PostgreSQL
-> ledger and durable transaction state
-> reconciliation evidence
-> external provider authoritative evidence where applicable

Redis is not financial truth.

RabbitMQ delivery is not financial truth.

A successful HTTP response, queue delivery, Redis key, or provider callback alone must never override durable verified financial state.

## 3. Incident severity

### SEV-1

Examples:

- PostgreSQL unavailable or corrupted
- ledger integrity concern
- suspected duplicate financial execution
- unreconciled external payment ambiguity
- widespread production outage

Action:

Stop unsafe write traffic and begin controlled recovery.

### SEV-2

Examples:

- RabbitMQ unavailable
- Redis unavailable
- one backend service unavailable
- notification processing degraded

Action:

Preserve durable state, isolate the affected component, and recover without unnecessary financial-system shutdown.

### SEV-3

Examples:

- non-critical UI degradation
- delayed notification
- monitoring/dashboard issue without transaction impact

Action:

Investigate while preserving production operation where safe.

## 4. Universal incident rules

DO NOT:

- delete the production PostgreSQL volume
- run docker compose down -v
- use --remove-orphans
- blindly replay financial requests
- blindly replay unpublished outbox events
- purge RabbitMQ queues as a recovery shortcut
- FLUSHALL or FLUSHDB Redis as a troubleshooting shortcut
- mark a payment successful because a queue message existed
- mark a payment successful solely from an unverified callback
- create financial movement merely to test recovery
- store or recover raw UPI PIN data
- bypass idempotency, fraud, authentication, reconciliation, or integrity controls

Always preserve evidence before destructive action.

## 5. PostgreSQL recovery

PostgreSQL is the authoritative durable datastore.

Current verified backup procedure uses PostgreSQL custom-format pg_dump.

Required recovery sequence:

1. Declare database recovery incident.
2. Prevent unsafe application write traffic.
3. Preserve the failed database/volume for forensic investigation where possible.
4. Select the newest verified backup.
5. Verify its SHA-256 checksum.
6. Restore first into an isolated PostgreSQL environment where practical.
7. Validate schema.
8. Validate Prisma migration history.
9. Validate critical tables.
10. Validate ledger/transaction invariants.
11. Review outbox state.
12. Review provider/webhook reconciliation state.
13. Only then promote the recovered database or reconnect production services.
14. Resume write traffic gradually.
15. Continue reconciliation after service restoration.

Never overwrite the existing production database merely to test a backup.

## 6. PostgreSQL validation checklist

Minimum expected checks:

- database starts successfully
- public schema restored
- Prisma migration history exists
- User table exists
- Wallet table exists
- LedgerAccount table exists
- LedgerEntry table exists
- Deposit table exists
- Withdrawal table exists
- Transfer table exists
- Payment table exists
- OutboxEvent table exists
- ProviderWebhookEvent table exists
- UpiPaymentIntent table exists
- UpiTransactionAudit table exists
- foreign keys exist
- ledger invariants remain valid
- transaction state transitions remain valid

Phase 10 restore proof established a 45-table restore baseline.

## 7. Redis recovery

Redis is classified as transient/rebuildable operational state.

Current known critical use includes payment-order rate limiting.

Redis recovery procedure:

1. Confirm PostgreSQL remains healthy.
2. Determine whether Redis itself or only connectivity failed.
3. Preserve existing Redis data volume when investigation is useful.
4. Restore Redis availability.
5. Verify PING.
6. Verify payment-service readiness.
7. Confirm rate-limit enforcement is operational.
8. Resume affected traffic only when security-sensitive Redis dependencies are healthy.

Loss of Redis state may reset transient rate-limit windows.

Redis recovery must never modify ledger balances or authoritative transaction history.

Security-sensitive payment order creation is expected to fail closed when required Redis enforcement is unavailable.

## 8. RabbitMQ recovery

RabbitMQ is durable delivery infrastructure.

Current architecture contains durable queues, retry queues and a dead-letter queue.

Recovery procedure:

1. Preserve PostgreSQL/outbox state.
2. Inspect RabbitMQ node health.
3. Inspect queue topology.
4. Inspect ready and unacknowledged counts.
5. Preserve the RabbitMQ volume if corruption or broker failure is suspected.
6. Restore broker availability.
7. Recreate topology through application/bootstrap configuration where appropriate.
8. Start consumers carefully.
9. Inspect durable outbox records before replay.
10. Use idempotency and durable transaction state to prevent duplicate side effects.
11. Inspect retry and dead-letter queues.
12. Reconcile uncertain external transactions independently.

Never infer business success from message acknowledgement alone.

## 9. Outbox recovery

OutboxEvent is durable PostgreSQL state.

Important:

An unpublished record does not automatically mean "publish immediately".

Before replay:

1. identify event type
2. inspect aggregate/payment/transaction state
3. confirm whether the downstream side effect already happened
4. check idempotency/deduplication evidence
5. check provider/webhook state where applicable
6. classify the event as safe replay, already satisfied, needs review, or invalid
7. only safe-replay events may be republished

Never bulk-replay all unpublished events without classification.

## 10. External payment / UPI recovery

For ambiguous external transactions:

Payflow durable state
-> webhook evidence
-> provider/partner authoritative status
-> reconciliation policy
-> controlled state transition

Never blindly retry a money-moving provider operation after timeout or ambiguous response.

UPI PIN must remain entirely outside Payflow storage/recovery procedures.

Current Real UPI partner integration remains HOLD until approved external partner onboarding/specification.

## 11. Service recovery order

Preferred sequence:

PostgreSQL
-> PostgreSQL integrity verification
-> Redis
-> RabbitMQ
-> Auth service
-> Wallet service
-> Payment service
-> Notification service
-> Reward service
-> API Gateway
-> customer/admin web
-> Prometheus/Grafana
-> Caddy/public ingress

Exact ordering may be adjusted based on the incident, but financial integrity verification precedes unrestricted write traffic.

## 12. Post-recovery validation

Check:

- PostgreSQL health
- Redis PING
- RabbitMQ health
- queue depth
- outbox state
- gateway health
- auth health
- wallet health
- payment health
- notification health
- reward health
- Prometheus targets
- active alerts
- application readiness

Do not create real money movement solely for validation.

## 13. Recovery objectives

Current pre-launch targets:

PostgreSQL:
- RPO: maximum 24 hours
- RTO: 60 minutes

Redis:
- RTO: 15 minutes

RabbitMQ:
- RTO: 30 minutes

These are operational targets, not contractual SLAs.

Before high-volume/live UPI operation, PostgreSQL recovery capability should be hardened with tighter automated backup intervals, offsite copies and preferably point-in-time recovery.

## 14. Evidence preservation

During an incident preserve where relevant:

- timestamps
- container state
- health state
- restart counts
- application logs
- correlation IDs
- payment IDs
- provider event IDs
- outbox IDs
- queue depths
- backup checksum
- recovery actions performed

Do not copy secrets, OTPs, raw authorization tokens, passwords, API keys, database passwords, or UPI PINs into incident reports.

## 15. Recovery completion gate

Recovery is complete only when:

- authoritative database is healthy
- integrity checks pass
- required security dependencies are healthy
- RabbitMQ delivery infrastructure is healthy
- uncertain financial transactions are classified/reconciled
- unsafe outbox replay has not occurred
- critical services report healthy/readiness
- monitoring is operational
- no unresolved integrity incident blocks traffic

## 16. Current architecture limitations

Current pre-launch limitations include:

- PostgreSQL backup schedule is not yet automated
- offsite backup replication is not yet proven
- PostgreSQL PITR is not yet configured
- Redis uses an anonymous Docker volume
- RabbitMQ is single-node
- RTO values are operational targets rather than measured SLA guarantees
- Real UPI partner rail is not live

These limitations must not be represented as production-grade HA or regulatory certification.