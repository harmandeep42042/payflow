# Payflow Onboarding Evidence Index

## Purpose

This index identifies technical readiness evidence currently available for Payflow and separates it from company, legal, certification, partner, infrastructure, and regulatory evidence that is not yet proven.

This document is an evidence index. It is not a certification, regulatory approval, banking approval, or live UPI authorization.

## Technical evidence available

### Privacy and data retention

Artifact:

docs/privacy/data-retention-policy.md

Evidence scope:

- internal data-retention principles
- privacy-oriented retention boundaries
- financial and audit records protected from generic purge
- automated production retention remains separately controlled

### Incident and recovery

Artifact:

docs/operations/incident-recovery-runbook.md

Evidence scope:

- incident response procedures
- recovery boundaries
- replay safety
- financial-state protection
- recovery escalation

RTO and RPO values documented by Payflow remain targets unless separately demonstrated as achieved operational service levels.

### Deployment and rollback

Artifacts:

deploy/README.md
deploy/Caddyfile
docker-compose.prod.yml
docker-compose.deploy.yml
deploy/.env.production.example

Evidence scope:

- production deployment structure
- domain and TLS boundary
- versioned release-tag contract
- health verification
- rollback procedure
- financial-state protection during rollback

Real public deployment remains externally gated.

### CI evidence

Artifact:

.github/workflows/ci.yml

Evidence scope:

- pull-request and main-branch CI definition
- dependency critical-audit gate
- backend build/test/lint verification
- frontend TypeScript verification

Production continuous deployment is not claimed.

### Mobile security boundary

Artifact:

docs/mobile/mobile-client-api-security-boundary.md

Evidence scope:

- mobile API foundation
- secure token-storage requirements
- device identity boundary
- biometric boundary
- push-notification boundary
- deep-link boundary
- application-integrity boundary
- separation between mobile application security and UPI authorization

A production mobile application is not claimed.

### UPI partner integration boundary

Artifact:

docs/payments/upi-partner-integration-boundary.md

Evidence scope:

- existing payment-rail reuse strategy
- partner specification requirement
- status and error mapping requirements
- callback security
- idempotency
- reconciliation
- credentials and certificate boundary
- UPI PIN protection
- external activation gates

This artifact does not represent a live PSP, sponsor-bank, or NPCI integration.

### Support and dispute boundary

Artifact:

docs/operations/support-dispute-operational-boundary.md

Evidence scope:

- complaint boundary
- operational case lifecycle
- transaction investigation
- failed and pending transaction handling principles
- refund and reversal boundary
- provider dispute boundary
- escalation
- auditability
- customer and admin workflow requirements

Partner-specific dispute mechanisms and authoritative regulatory timelines remain external.

### UPI partnership readiness pack

Artifact:

D:/my work/payflow-upi-onboarding/Payflow-UPI-Partnership-Readiness-Pack.pdf

Evidence scope:

- partner-discussion readiness material

The pack must not be treated as a formal submission until company, legal, commercial, and other placeholders are verified by authorized stakeholders.

## Security maturity evidence

Payflow has internal technical evidence relating to security controls, transaction integrity, fraud controls, observability, incident response, CI, secrets boundaries, container hardening, logging policy, reconciliation, and recovery.

Internal technical controls do not by themselves constitute independent certification.

## Company and legal evidence required

The following must be supplied and verified by authorized company stakeholders as applicable:

- legal entity identity
- registered address
- authorized signatory information
- ownership information
- business model information
- banking information
- financial information or statements
- legal policies and agreements requested by the selected partner

No missing company information should be fabricated.

## External assurance evidence

The following are not currently proven:

- formal VAPT report or certificate
- ISO 27001 certification
- SOC 2 report
- PCI DSS status
- other independent assurance requested by a future partner

Whether each item is required must be determined from authoritative partner, contractual, regulatory, or applicable compliance requirements.

## UPI partner evidence pending

The following remain external:

- PSP or sponsor-bank selection
- partner technical specification
- sandbox credentials
- certificates or key material required by the partner
- sandbox and UAT evidence
- certification evidence where applicable
- production credentials
- explicit production or live approval

## Public production evidence pending

The following remain externally gated:

- production VPS or cloud host
- public IPv4 where required
- real production domain
- DNS configuration
- public TLS
- real public API URL
- public production deployment

## Deferred operational improvements

The following remain explicitly deferred or unproven:

- automated offsite backup
- PostgreSQL PITR capability
- external alert delivery
- true multi-host high availability
- achieved RTO/RPO service-level evidence

## Claim boundary

Payflow may describe itself as having substantial internal technical readiness evidence.

Payflow must not claim, without authoritative evidence:

- NPCI approval
- PSP approval
- sponsor-bank approval
- regulatory licensing
- ISO 27001 certification
- SOC 2 certification
- PCI DSS certification
- live UPI connectivity
- production UPI approval

Technical readiness is not equivalent to external approval.

## Current onboarding status

Internal technical evidence package: available.

Company/legal evidence: requires authorized company input.

Independent assurance: not proven.

PSP/sponsor-bank onboarding: pending.

Real UPI credentials and partner specification: pending.

Public production deployment: hold.

Live UPI status: not live.