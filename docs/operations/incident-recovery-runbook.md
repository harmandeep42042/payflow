# Payflow Incident and Recovery Runbook

## Purpose

This runbook defines Payflow's operator decision path for detecting, triaging, containing, recovering from, and verifying production incidents.

## Core safety principle

An alert alone is not authorization to restart, rollback, replay messages, restore a database, or modify financial state.

## 1. Detection

- Confirm the alert or reported symptom.
- Check gateway and affected-service health.
- Compare current container restart counts with the known baseline.
- Determine whether the symptom is reproducible.

## 2. Triage

- Identify the affected service and dependency chain.
- Check application, PostgreSQL, RabbitMQ, and Redis health where relevant.
- Preserve logs and diagnostic evidence.
- Do not expose credentials, OTP values, tokens, PINs, or sensitive financial data while collecting evidence.

## 3. Classification

- If health is normal, restart counts are unchanged, and the symptom cannot be reproduced: classify as alert not reproduced and continue monitoring.
- If one application service is unhealthy while dependencies remain healthy: investigate the application service before considering restart or rollback.
- If a shared dependency is unhealthy: treat the dependency as the primary incident boundary.
- If financial state may be inconsistent: stop unsafe recovery actions and perform integrity and reconciliation checks before mutation.

## 4. Recovery decision

- Restart is allowed only after evidence indicates that restart is appropriate.
- Rollback requires an identified known-good release and verification that schema and data compatibility are safe.
- Database restore is a last-resort recovery action and requires explicit approval, backup validation, and recovery-point assessment.
- RabbitMQ or outbox replay must never be performed blindly.
- Financial events must not be replayed solely because a queue is empty or historical metadata appears inconsistent.

## 5. Financial integrity boundary

- PostgreSQL remains the authoritative persistent financial state unless architecture explicitly defines otherwise.
- Redis must not be treated as the authoritative financial ledger.
- Message delivery state must not override authoritative transaction state.
- Before replay or recovery of financial events, verify idempotency, transaction status, reconciliation state, and downstream side effects.

## 6. Recovery verification

- Confirm gateway health.
- Confirm affected-service health.
- Confirm dependency health.
- Compare restart counts against the incident baseline.
- Verify that no unexpected container restart loop exists.
- For financial incidents, perform reconciliation and integrity verification before declaring recovery complete.

## 7. Escalation boundary

- Public deployment changes require release approval.
- Production container recreation requires release approval.
- Database restore requires explicit recovery approval.
- Queue or outbox replay requires explicit incident-specific approval.
- Real UPI or provider-side recovery must follow the approved partner/provider procedure when those integrations become active.

## 8. Current drill result

- Simulated payment-path degradation was investigated without failure injection.
- Gateway and payment health remained healthy.
- PostgreSQL, RabbitMQ, and Redis remained healthy.
- No restart-count regression was detected.
- The simulated alert was not reproduced.
- Correct operator decision: do not restart or rollback.

## Current limitation

This runbook validates the operational decision process. It does not prove multi-host high availability, production RTO achievement, production RPO achievement, provider recovery capability, or live UPI recovery certification.
