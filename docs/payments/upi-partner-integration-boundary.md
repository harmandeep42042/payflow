# Payflow UPI Partner Integration Boundary

## Purpose

This document defines the internal boundary for a future approved UPI PSP or sponsor-bank integration.

It does not define or fabricate NPCI, PSP, sponsor-bank, or bank APIs.

Actual implementation must follow the selected partner's approved specification.

## Existing payment foundation

Payflow already contains payment-rail architecture and a Razorpay payment-rail adapter foundation.

Razorpay integration must not be treated as proof of a UPI PSP or sponsor-bank integration.

Existing payment state, idempotency, webhook, provider-event, reconciliation, settlement, fraud, audit, and observability controls should be reused where their contracts remain valid.

A second competing provider abstraction must not be introduced without architectural justification.

## Future partner adapter

When an approved partner specification becomes available, the implementation must first evaluate whether the existing PaymentRail contract can represent the required partner operations.

If it can, the UPI partner should implement or extend the existing rail boundary.

If it cannot, the contract may be extended through a reviewed backward-compatible design.

Provider-specific behavior must not leak unnecessarily into core financial domain logic.

No fake PSP adapter should be created to simulate production readiness.

## Partner specification required

Before implementation, obtain authoritative partner definitions for:

- authentication and authorization
- certificates, keys, signing, and encryption
- sandbox and production endpoints
- request and response schemas
- bank discovery
- bank-account linking
- device binding
- UPI registration
- VPA provisioning
- Pay
- Collect
- QR and intent flows
- status enquiry
- reversal and refund behavior
- callbacks and webhooks
- partner transaction identifiers
- timeout behavior
- retry rules
- idempotency requirements
- error codes
- reconciliation
- settlement
- dispute handling
- certification and production onboarding

## Status mapping

Partner statuses must be explicitly mapped into Payflow's internal transaction state machine.

Unknown partner statuses must not silently become successful transactions.

A partner acknowledgement must not automatically be interpreted as final financial success unless the approved partner contract defines it that way.

Terminal and non-terminal states must be documented before production activation.

## Error mapping

Partner-specific errors must be mapped into controlled internal error categories.

Unknown or ambiguous provider errors must fail safely.

Provider error text must not directly control financial state transitions.

## Idempotency

Every partner operation that can create or change financial state must follow the approved partner idempotency model and Payflow's internal idempotency controls.

Retries must not create duplicate financial effects.

Timeouts must not automatically imply failure or success when provider state is unknown.

## Callback and webhook boundary

Callbacks must be authenticated according to the approved partner specification.

Where supported, processing should include:

- signature or certificate verification
- provider event identity
- duplicate-event protection
- idempotent processing
- controlled state transitions
- audit evidence
- safe error handling

A callback alone must not bypass transaction-integrity controls.

Blind webhook replay is prohibited.

## Reconciliation

Provider state and Payflow state must be reconciled using the approved partner reconciliation contract.

Differences must be classified and investigated.

Reconciliation must not rewrite ledger or financial history merely to force states to match.

Recovery actions must remain auditable.

## Financial authority

The mobile client is not authoritative for financial state.

Provider callbacks are not independently authoritative outside the approved transaction-state and reconciliation rules.

Payflow ledger and transaction records must remain internally consistent and auditable.

External provider state must be incorporated through controlled transitions and reconciliation.

## UPI PIN boundary

Raw UPI PIN must never be stored, logged, persisted, copied into application telemetry, or handled as ordinary Payflow application data.

Payflow must not invent its own UPI PIN verification mechanism.

UPI PIN flows must use the approved partner and UPI security model.

## Secrets and certificates

Real partner credentials must not be committed to source control.

Production secrets, private keys, certificates, and signing material must follow the approved deployment and key-management process.

Placeholder credentials must never be represented as real integration readiness.

## Mobile boundary

Bank discovery, account linking, UPI device binding, VPA provisioning, UPI PIN flows, real UPI Pay, Collect, QR, and intent remain blocked until authoritative partner specifications are available.

Mobile UI may be designed separately, but it must not fabricate successful UPI-network behavior.

## Activation gates

Real UPI network integration remains disabled until all applicable gates are satisfied:

1. PSP or sponsor-bank selected.
2. Partner technical specification received.
3. Sandbox credentials and required certificates received.
4. Adapter implementation reviewed and tested.
5. Callback/status/error/idempotency mappings verified.
6. Reconciliation and recovery verified.
7. Security requirements verified.
8. Required sandbox/UAT/certification completed.
9. Production credentials received.
10. Production/live approval explicitly granted.

## Current classification

Existing payment/provider foundation: present.

Existing PaymentRail reuse: preferred subject to exact partner requirements.

New generic payment-provider abstraction: not justified at this stage.

Real UPI partner implementation: externally blocked.

Fake NPCI or PSP implementation: prohibited.

Production UPI activation: prohibited until external onboarding and approval gates are complete.