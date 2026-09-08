# Payflow RTO / RPO Baseline

Status: Phase 10.5 baseline
Scope: current Payflow production architecture
Environment: Docker-based production stack

## Recovery hierarchy

1. PostgreSQL is the authoritative durable datastore.
2. Redis is transient operational state and must not be treated as the financial system of record.
3. RabbitMQ is delivery infrastructure; durable PostgreSQL/outbox state is the recovery anchor for publish/replay decisions.
4. Provider and UPI reconciliation must use durable database evidence and partner/provider authoritative status, never Redis or queue presence alone.

## PostgreSQL

Verified logical backup:
- Format: PostgreSQL custom format
- Backup validation: PASS
- SHA-256 verification: PASS
- Isolated restore verification: PASS
- Restored public tables: 45/45
- Production database remained unchanged during restore proof.

Initial RPO target:
- Maximum 24 hours for scheduled logical backups during pre-launch operations.
- A lower RPO must be adopted before materially higher transaction volume or live external UPI launch.
- Durable financial transactions created after the latest backup may require reconstruction/reconciliation from replicated/offsite data, provider evidence, or other approved recovery sources if a total database loss occurs.

Initial RTO target:
- 60 minutes for PostgreSQL service recovery in the current single-host/pre-launch environment.
- This is an operational target, not an SLA or measured certification.
- Restore procedure must use a verified backup and post-restore integrity checks before application write traffic resumes.

## Redis

Recovery class:
- Transient / rebuildable operational state.
- Current observed key count at this baseline: 0.
- Redis is used for payment-order rate limiting.
- Redis loss must not alter PostgreSQL ledger/balance truth.
- Redis unavailability should fail closed where security-sensitive enforcement depends on it.

Initial RPO:
- No financial-data RPO assigned because Redis is not the authoritative financial datastore.
- Ephemeral rate-limit state may be lost during recovery.

Initial RTO:
- 15 minutes target to restore Redis availability or deploy a clean replacement instance.
- Application readiness/security controls must determine whether traffic can safely resume.

## RabbitMQ

Recovery class:
- Durable delivery infrastructure.
- Durable queues are configured.
- PostgreSQL outbox provides durable publish intent/evidence.
- Queue recovery must avoid blind replay and duplicate financial side effects.

Current outbox baseline:
59|49|10

Initial RPO:
- Financial business state RPO follows PostgreSQL, not RabbitMQ.
- Queued-but-not-yet-consumed delivery state may require recovery from RabbitMQ persistence or safe replay from durable outbox records.

Initial RTO:
- 30 minutes target to restore broker availability/topology in the current pre-launch environment.

## Recovery ordering

Recommended recovery order:

PostgreSQL
-> integrity verification
-> Redis
-> RabbitMQ
-> application services
-> outbox/retry/reconciliation review
-> health/readiness verification
-> controlled traffic resumption

## Safety requirements

- Never restore a backup over the production database without an explicit disaster declaration and recovery procedure.
- Never delete the production PostgreSQL volume as a troubleshooting shortcut.
- Never blindly replay unpublished outbox events without idempotency and state review.
- Never infer payment success from RabbitMQ delivery alone.
- Never infer financial truth from Redis.
- Never store or recover raw UPI PIN data.
- External provider/UPI state must be reconciled using approved authoritative evidence.

## Current limitations

- Backup scheduling is not yet automated.
- Offsite backup replication is not yet proven.
- PostgreSQL point-in-time recovery is not yet configured.
- Redis currently uses an anonymous Docker volume.
- RabbitMQ is currently single-node.
- Current RTO values are targets, not formally measured SLA commitments.
- Current PostgreSQL RPO target is conservative and must improve before live high-volume UPI operations.