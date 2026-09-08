# Payflow Data Retention and Privacy Control Policy

## Purpose

This document defines Payflow's internal data-retention boundaries without deleting or modifying production records.

## Classification

### Short-lived security data

- Refresh-token records are security/session data.
- Existing expiresAt and revokedAt controls must be respected.
- Expired or revoked security records may become eligible for cleanup only through an explicitly approved cleanup process.
- Raw authentication secrets, OTP values, access tokens, refresh tokens, PINs, and provider secrets must not be logged or retained beyond their required security lifecycle.

### User personal data

- User profile data may include email, phone, first name, last name, IP address, user agent, and device-related metadata.
- Personal data must be collected only for an explicit application, security, fraud, support, or compliance purpose.
- Personal data must not be automatically deleted or anonymized until account lifecycle, legal, fraud, dispute, and regulatory requirements are defined.

### Operational data

- Notification, notification-log, provider-webhook, request, reward, and similar operational records require an explicit retention schedule before automatic deletion is enabled.
- Operational metadata should not contain unnecessary credentials or secrets.

### Financial and integrity records

- Payment, transfer, wallet, ledger, reconciliation, settlement, audit, dispute, and related financial-integrity records must not be automatically purged by generic retention jobs.
- Financial and audit retention periods must follow applicable legal, regulatory, PSP, sponsor-bank, payment-provider, accounting, dispute, and contractual obligations.
- Payflow must not invent or hard-code regulatory retention periods before those obligations are formally confirmed.

## Deletion and anonymization boundary

- No automatic production purge is authorized by this policy.
- No financial record deletion is authorized by this policy.
- No audit-log deletion is authorized by this policy.
- No user anonymization is authorized until identity, fraud, dispute, financial-record, and compliance dependencies are reviewed.
- Any future deletion job must be model-specific, auditable, bounded, reversible where feasible, tested on non-production data first, and protected by explicit approval.

## Logging and privacy

- Secret values must never be deliberately written to application logs.
- PII in logs should be minimized and masked where operationally possible.
- Correlation and request identifiers are preferred over repeating user identifiers in diagnostic logs.

## Current Payflow status

- RefreshToken has explicit expiry and revocation fields.
- Multiple domain features use expiresAt semantics.
- Explicit global retention, anonymization, purge, archive, and soft-delete policies are not currently implemented.
- Therefore automated data-retention deletion remains disabled by design.

## Activation boundary

Automated retention or deletion must remain disabled until retention periods and legal/compliance requirements are approved for the relevant data class.
