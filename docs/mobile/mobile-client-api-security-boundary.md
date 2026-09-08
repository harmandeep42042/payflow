# Payflow Mobile Client API & Security Boundary

## Purpose

This document defines what the future Payflow mobile client may use from the existing backend, what security responsibilities belong to the mobile client, and which UPI capabilities must remain blocked until an approved PSP/sponsor-bank specification is available.

## Existing backend capabilities

The current API gateway exposes a mobile-usable foundation for:

- registration and login
- access and refresh token flows
- OTP request and verification
- mobile OTP request, verification, and registration
- logout
- password recovery and password change
- profile read and update
- current-session inspection
- session listing and session revocation
- wallet lookup and transaction history
- recipient resolution
- wallet transfers
- VPA-based internal transfer
- wallet QR retrieval, verification, and payment
- payment order creation, confirmation, and lookup
- notification read/update/delete flows
- notification preferences

These capabilities are backend foundations only. Their presence does not mean a production Android or iOS client already exists.

## Mobile client responsibilities

The future mobile client must provide:

- secure storage for access and refresh tokens
- no plaintext token persistence
- app-level logout that clears local credentials
- biometric or device-authenticated app unlock where appropriate
- safe session/device association
- camera permission handling for QR scanning
- deep-link handling only after approved public domains exist
- push-notification token registration when a push provider is selected
- network error and retry handling
- protection against duplicate payment actions
- no trust in client-side balance or transaction state as authoritative

The backend and database remain authoritative for financial state.

## Device identity

The current backend foundation does not yet expose a proven dedicated mobile device identifier contract.

Before production mobile rollout:

- define a server-controlled device registration model
- do not use hardware identifiers such as IMEI as an application identity
- do not trust a client-generated device ID as a sole authentication factor
- associate sessions with approved device metadata only as a risk signal
- support device/session revocation
- preserve privacy and minimization requirements

## Token security

Access and refresh credentials must be stored using operating-system-backed secure storage.

The mobile client must not:

- store credentials in plaintext files
- log access tokens or refresh tokens
- include tokens in analytics events
- expose tokens in deep links or URLs
- treat biometric unlock as a replacement for server authentication

## Biometrics

Biometric authentication is a local app-security feature.

It may protect local access to the Payflow application but must not:

- replace backend authentication
- replace payment authorization requirements
- replace any future approved UPI PIN flow

## Push notifications

Push notifications are not currently established as a production mobile integration.

Future implementation requires:

- a selected push provider
- mobile push-token lifecycle handling
- backend token registration/revocation
- notification privacy controls
- no sensitive financial secrets in push payloads

## Deep links

Deep links remain deferred until real public domains and application ownership verification are available.

Do not introduce fake production domains.

## Android integrity

Android application-integrity controls such as Play Integrity may be integrated later.

They must be treated as risk signals and not as a single source of authorization.

## iOS integrity

iOS attestation/integrity support is a future mobile requirement and must be designed when an iOS application is actually planned.

## UPI boundary

The following capabilities must not be fabricated before an approved PSP/sponsor-bank specification exists:

- bank discovery
- bank-account linking
- UPI device binding
- UPI registration
- VPA provisioning
- UPI PIN setup, reset, or authorization
- real UPI Pay
- real UPI Collect
- real UPI QR
- UPI intent
- provider-specific callback handling
- partner transaction identifiers

Internal Payflow wallet/VPA/QR functionality must not be described as live NPCI-network UPI.

## UPI PIN protection

Raw UPI PIN must never be stored, logged, proxied as normal application data, or persisted by Payflow.

The final UPI PIN flow must follow the approved partner and UPI security model.

## Financial integrity

The mobile client must never be considered authoritative for:

- wallet balance
- payment status
- transfer status
- reconciliation status
- reversal status
- settlement status

The backend state machine, ledger, transaction records, and approved external provider state remain authoritative.

## Current readiness classification

Backend mobile foundation: substantially ready.

Mobile application implementation: not started.

Mobile platform integrations: remaining.

Real UPI mobile implementation: externally blocked pending PSP/sponsor-bank specifications, credentials, certification, and approval.

## Current safety boundary

No fake UPI API is permitted.

No fake partner credentials are permitted.

No raw UPI PIN storage is permitted.

No production public domain is assumed.

No production mobile release is authorized by this document.