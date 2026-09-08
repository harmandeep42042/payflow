# Payflow Production Freeze

## Repo-side state

- Product feature development: frozen
- Final security regression: PASS
- Release code blockers: closed
- Production Docker Compose structure: complete
- Production Caddy reverse-proxy contract: complete
- Public browser API URL: environment-controlled
- Production cookies: Secure
- Production env template: deploy/.env.production.example

## Intentional external holds

These items are not repo-side defects and must not be faked to make builds pass:

- Real non-local HTTPS NEXT_PUBLIC_API_GATEWAY_URL
- Production domain, DNS, server and infrastructure credentials
- Real production secrets
- PSP / Sponsor Bank onboarding and NPCI activation for live UPI
- External Recharge / BBPS / AutoPay provider activation where applicable

## Production build

The Web production build remains intentionally unexecuted until the real
NEXT_PUBLIC_API_GATEWAY_URL is supplied.

## Live-money status

Payflow must not be represented as live UPI or live bank settlement until
the required external partner, certification and production activation
steps are completed.

## Freeze rule

Do not modify application source or production configuration after this
checkpoint unless a real deployment smoke test exposes a genuine release
defect.

Remaining flow:

1. Supply external production values.
2. Run production build.
3. Deploy production containers.
4. Run deployment smoke tests.
5. Activate external regulated/provider integrations separately.
