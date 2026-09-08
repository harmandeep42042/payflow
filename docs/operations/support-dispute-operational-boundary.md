# Payflow Support & Dispute Operational Boundary

## Purpose

This document defines the operational boundary for customer support, transaction investigation, complaints, disputes, reversals, refunds, and escalation.

It does not create regulatory timelines, partner dispute APIs, or automatic financial remedies.

## Existing investigation foundation

Payflow already contains strong transaction investigation and recovery foundations, including:

- payment and transfer status tracking
- transaction history
- reconciliation logic
- reversal and refund signals
- provider webhook event persistence
- idempotency controls
- audit logging
- administrative transaction visibility

These foundations support investigation but do not by themselves constitute a complete complaint-management system.

## Customer complaint boundary

A production support system should associate every complaint with a unique internal support or complaint reference.

A support case should be able to reference:

- customer identity
- transaction reference
- payment or transfer reference
- complaint category
- current case status
- investigation notes
- evidence references
- escalation state
- partner case reference when one exists
- final resolution

Sensitive information must be minimized and protected.

## Case lifecycle

The internal case lifecycle should distinguish operational support state from financial transaction state.

Example internal case states may include:

- OPEN
- UNDER_REVIEW
- WAITING_FOR_CUSTOMER
- WAITING_FOR_PARTNER
- ESCALATED
- RESOLVED
- CLOSED

These are operational case states only.

They must not directly control payment, transfer, ledger, settlement, refund, or reversal state.

## Transaction investigation

Support staff should investigate using authoritative system evidence, including where applicable:

- transaction status
- ledger records
- reconciliation results
- provider webhook records
- idempotency records
- audit logs
- notification history
- external provider status once partner integration exists

Customer screenshots or descriptions may support investigation but are not authoritative financial state.

## Failed and pending transactions

A failed or pending transaction must be investigated according to transaction-state, reconciliation, and provider rules.

A timeout does not automatically prove success or failure.

A complaint must not be used to manually force a transaction into a desired status.

## Refund and reversal boundary

Complaint creation must never automatically trigger a refund or reversal.

Refund or reversal actions require controlled financial rules and authoritative evidence.

Blind refunds are prohibited.

Blind reversals are prohibited.

Financial history must remain auditable.

## Provider dispute boundary

Future partner-specific dispute handling must use authoritative PSP or sponsor-bank documentation.

Do not invent:

- partner dispute APIs
- partner dispute IDs
- partner reason codes
- partner response codes
- regulatory or network timelines
- settlement rules
- escalation timelines

Partner identifiers should be stored separately from Payflow internal support references.

## Escalation

Cases that cannot be safely resolved internally should be escalated to the appropriate operational owner.

Depending on the final partner and production setup, escalation may include:

- internal operations
- security or fraud review
- reconciliation review
- PSP or sponsor-bank support
- payment provider support
- compliance or grievance handling

Exact regulatory escalation paths and timelines must be taken from authoritative requirements.

## Auditability

Support actions affecting investigation or case state should be auditable.

Any financial action resulting from an investigation must remain separately auditable through the financial transaction and ledger controls.

Support tooling must not bypass authorization, fraud, reconciliation, or transaction-integrity controls.

## Replay safety

Support staff must not use blind webhook replay as a recovery mechanism.

Support staff must not use blind outbox replay as a recovery mechanism.

Historical provider events must be handled according to established idempotency and recovery procedures.

## Customer visibility

A future customer-facing support experience should provide:

- complaint or support reference
- high-level case status
- transaction reference
- safe progress updates
- final resolution information

Sensitive internal fraud signals, secrets, provider credentials, or security evidence must not be exposed.

## Admin workflow

A future administrative workflow should support:

- search by complaint reference
- search by transaction reference
- customer lookup
- transaction investigation
- case status updates
- controlled notes
- evidence references
- escalation
- partner reference mapping
- resolution recording
- audit trail

Administrative support tooling must not provide unrestricted direct ledger manipulation.

## Current classification

Transaction investigation foundation: present.

Reconciliation and recovery foundation: present.

Formal complaint management: not yet proven as a complete implementation.

Customer case tracking: future product capability unless explicitly implemented and verified.

Admin case workflow: future product capability unless explicitly implemented and verified.

Partner dispute integration: external and partner-dependent.

Regulatory timelines: external authoritative requirement.

Automatic financial state change from complaint: prohibited.