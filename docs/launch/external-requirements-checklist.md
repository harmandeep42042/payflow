# Payflow External Requirements Master Checklist

## Purpose

This checklist identifies requirements that remain outside Payflow's currently completed internal launch-preparation work.

It must not be interpreted as proof of production deployment, regulatory approval, PSP approval, sponsor-bank approval, certification, or live UPI connectivity.

## Gate 1 - Public production infrastructure

Status: HOLD / EXTERNAL INPUT REQUIRED

Required before public production activation:

- production VPS or cloud host
- suitable CPU, memory, storage, and network capacity
- public IPv4 where required
- supported Linux host
- Docker Engine and deployment prerequisites
- firewall configuration
- only required public services exposed
- production host access and operational ownership

Current Payflow deployment package is prepared, but public deployment has not been activated.

## Gate 2 - Domain and DNS

Status: HOLD / EXTERNAL INPUT REQUIRED

Required:

- real production domain
- customer hostname
- admin hostname
- API hostname
- DNS records pointing to the approved production host
- domain ownership and access

Do not substitute fake public domains.

## Gate 3 - Public TLS and API URL

Status: BLOCKED BY INFRASTRUCTURE AND DOMAIN

Required:

- successful public DNS resolution
- public HTTPS/TLS activation
- real API hostname
- real NEXT_PUBLIC_API_GATEWAY_URL
- real server API_GATEWAY_URL
- external HTTPS health verification

Frontend production release must not use a fabricated public API URL.

## Gate 4 - Production release activation

Status: HOLD

When explicitly resumed:

- inject verified production public values
- validate production environment
- build customer frontend
- build admin frontend
- build/version production application images
- use an approved RELEASE_TAG
- perform controlled deployment
- verify health
- verify restart counts
- verify customer/admin/API routing
- preserve rollback capability

No production recreation should occur while the release hold remains active.

## Gate 5 - Mobile application

Status: CLIENT IMPLEMENTATION REMAINING

Internal backend mobile foundation is substantially prepared.

Remaining mobile work includes:

- Android application implementation
- secure token storage
- device registration model
- biometric application unlock where appropriate
- QR camera integration
- push notification integration
- deep-link handling
- application integrity controls
- mobile security testing
- production signing and release process

iOS may be addressed separately when required.

Real UPI-specific mobile behavior remains partner-dependent.

## Gate 6 - Company and legal information

Status: AUTHORIZED USER OR COMPANY INPUT REQUIRED

Potential onboarding material includes, as applicable:

- legal entity information
- registered address
- authorized representatives or signatories
- ownership information
- business model
- banking information
- financial information or statements
- policies, agreements, and declarations requested by the selected partner

Only verified company information may be supplied.

Do not fabricate missing legal or company information.

## Gate 7 - PSP or sponsor-bank selection

Status: EXTERNAL PENDING

Required:

- select an appropriate PSP or sponsor-bank path
- initiate authorized commercial/onboarding discussion
- obtain partner onboarding requirements
- obtain authoritative technical documentation
- establish commercial and operational contacts

No PSP or sponsor-bank approval is currently claimed.

## Gate 8 - Real UPI technical specification

Status: EXTERNAL PENDING

Required from the approved partner as applicable:

- authentication model
- certificates and key requirements
- signing/encryption requirements
- sandbox endpoints
- production endpoints
- request and response schemas
- bank discovery contract
- account-linking contract
- UPI device-binding contract
- registration contract
- VPA provisioning contract
- Pay contract
- Collect contract
- QR and intent contract
- status enquiry
- callback/webhook contract
- reversal/refund behavior
- error codes
- retry/idempotency rules
- reconciliation
- settlement
- dispute mechanisms

Do not fabricate provider APIs.

## Gate 9 - UPI security boundary

Status: PARTNER DEPENDENT

Raw UPI PIN must never be stored or logged by Payflow as ordinary application data.

Payflow must not invent its own UPI PIN verification mechanism.

Device binding, UPI PIN, and other network security flows must follow the approved partner and applicable UPI security model.

## Gate 10 - Sandbox integration

Status: EXTERNAL PENDING

Required before implementation/testing:

- approved sandbox access
- sandbox credentials
- required certificates or keys
- partner test data
- partner test scenarios
- approved API documentation

Only after these are received should the real partner adapter be implemented.

## Gate 11 - UAT and certification

Status: EXTERNAL PENDING

As required by the selected partner and applicable ecosystem:

- functional UAT
- negative-path testing
- callback testing
- timeout/retry testing
- reconciliation verification
- security verification
- mobile-flow verification
- required certification evidence

Exact certification requirements must come from authoritative sources.

## Gate 12 - Production UPI activation

Status: EXTERNAL PENDING

Required:

- production credentials
- production certificates/keys as applicable
- approved production endpoints
- final configuration verification
- explicit production/live approval
- controlled activation

Live UPI must not be claimed before these gates are satisfied.

## Gate 13 - Support and dispute implementation

Status: PRODUCT + EXTERNAL WORK REMAINING

Operational boundary is documented.

Future implementation may require:

- formal complaint/case persistence
- complaint reference IDs
- customer case tracking
- admin investigation workflow
- evidence handling
- escalation workflow
- partner case mapping
- partner dispute APIs
- authoritative turnaround and escalation requirements

Complaint creation must not automatically alter financial state.

## Gate 14 - Independent security assurance

Status: NOT PROVEN / REQUIREMENT DEPENDENT

Potential external evidence may include:

- VAPT
- mobile security assessment
- API security assessment
- infrastructure assessment
- other partner-requested assurance
- certifications where actually required

Payflow must not claim certifications that have not been obtained.

## Gate 15 - Backup and recovery improvement

Status: HOLD

Future production improvement:

- automated backups
- offsite backup destination
- protected credentials
- encryption as appropriate
- backup monitoring
- restore verification
- PostgreSQL PITR where required

Current documented RTO/RPO values remain targets unless operationally demonstrated.

## Gate 16 - External alert delivery

Status: HOLD

Future integration requires an approved alert destination such as the operational channel selected by the production owner.

Alert routing and escalation ownership must be defined before live operations.

## Gate 17 - High availability

Status: FUTURE SCALE / HARDENING

Current deployment remains fundamentally single-host and single-instance for major components.

True multi-host high availability is not currently claimed.

Architecture should be revisited as production scale and availability requirements become known.

## Resume order

Recommended external execution order:

1. Verify company/legal onboarding information.
2. Select PSP or sponsor-bank path and begin onboarding.
3. Provision production infrastructure and domain when launch timing justifies it.
4. Configure DNS and public TLS.
5. Activate real production API URLs and frontend release.
6. Obtain UPI partner specifications and sandbox credentials.
7. Implement the real partner adapter against authoritative specifications.
8. Build and harden the mobile application around the approved flows.
9. Complete sandbox, UAT, security, and certification requirements.
10. Complete support/dispute operational implementation.
11. Obtain production credentials and explicit live approval.
12. Perform controlled production activation.
13. Improve backup, alerting, and HA according to operational requirements.

## Current Payflow classification

Internal platform engineering: substantially prepared.

Deployment package: prepared, external activation held.

Mobile backend foundation: substantially prepared.

Mobile client: not implemented.

UPI integration boundary: prepared.

Real PSP/sponsor-bank integration: pending.

Public production deployment: hold.

Independent certification: not proven.

Live UPI: no.

## Core rule

Internal technical readiness is not equivalent to external approval or live UPI connectivity.