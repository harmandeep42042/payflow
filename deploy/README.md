# Payflow production deployment contract

This directory describes the static contract for the audited Payflow release.
It does not own the production data services or perform database migrations.

## Release images

Set `RELEASE_TAG` to the audited Git commit used to build all eight application
images. `docker-compose.deploy.yml` fails configuration when `RELEASE_TAG` or
any Caddy domain is missing. Image digests are not claimed or implied; release
operators must build, publish, and verify the images through the approved
release process before deployment.

### Frontend build-time API URL

`NEXT_PUBLIC_API_GATEWAY_URL` is mandatory when building both `web` and
`admin-web` for production. Next.js embeds this public, non-secret endpoint in
the browser bundles, so it must be supplied to the Nx build process before the
standalone artifacts are created. The production build rejects missing,
malformed, and local-only values instead of silently embedding the development
localhost fallback.

The frontend Dockerfiles package prebuilt `.next/standalone` artifacts. A Docker
build argument would therefore arrive too late to change the client bundle and
is intentionally not used. Supply the variable without printing it, then run:

```powershell
if ([string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_API_GATEWAY_URL)) {
  throw 'NEXT_PUBLIC_API_GATEWAY_URL must be supplied securely'
}
pnpm.cmd nx run-many -t build --projects=web,admin-web --configuration=production --skip-nx-cache
```

Do not add `NEXT_PUBLIC_API_GATEWAY_URL` to `docker-compose.deploy.yml`: changing
a container runtime variable cannot modify an already-built Next.js client
bundle. The localhost fallback remains available for local development only.

## External infrastructure

The external Docker network `payflow_default` must already exist. The following
externally managed services must be reachable from that network:

| Dependency | Docker hostname | Internal port |
| --- | --- | ---: |
| PostgreSQL | `postgres` | 5432 |
| Redis | `redis` | 6379 |
| RabbitMQ | `rabbitmq` | 5672 |

Their production health checks, credentials, persistent volumes, backups,
upgrades, restart policies, and lifecycle are managed outside this application
compose file. `DATABASE_URL`, `REDIS_URL`, and `RABBITMQ_URL` must use these
internal hostnames. RabbitMQ queue names are supplied through `RABBITMQ_QUEUE`
and `PAYMENT_RABBITMQ_QUEUE`.

No Prisma migration command is part of application container startup. Database
migrations require a separate, explicitly approved operational procedure.

## Caddy ingress

Caddy listens on container ports 80 (HTTP) and 443 (HTTPS). Compose maps:

- host 8080 to container 80;
- host 8443 to container 443.

The public host, NAT, or load balancer must therefore map public port 80 to host
port 8080 and public port 443 to host port 8443. If Caddy is intended to bind
public ports directly, changing these mappings is a separate deployment decision
and must not be inferred from this configuration.

Caddy routes the customer domain to `web:3000`, the admin domain to
`admin-web:3001`, and the API domain to `api-gateway:4000`. No application
service publishes a host port.

## Health checks

Customer web, admin web, API gateway, auth, payment, notification, and reward
use existing credential-free HTTP routes for container health. Caddy waits for
its three ingress upstreams to become healthy. Wallet uses a process-level
liveness check because its existing HTTP health route queries PostgreSQL; Docker
health polling must not create a production database-readiness dependency.

PostgreSQL, Redis, and RabbitMQ readiness remains part of the external
infrastructure contract and is not modeled by this compose file.

## Provider-dependent features

Recharge, Bills, and AutoPay remain `PROVIDER_NOT_CONFIGURED` unless genuine
provider settings are supplied through an approved production secret-management
process. Provider variables are intentionally optional and are not included as
mandatory production deployment values. Do not substitute mock credentials or
interpret an application attempt record as provider success.

## Production rollback

Rollback must be evidence-based and must not be triggered only because an alert fired.

Before rollback:

- Confirm the regression is reproducible and linked to the new release.
- Record the current RELEASE_TAG and the previous known-good release tag.
- Confirm PostgreSQL, RabbitMQ, Redis, and gateway health before making changes.
- Do not reset, delete, or rewrite financial state to make a release appear healthy.
- Do not replay RabbitMQ messages or outbox events blindly.
- Do not restore PostgreSQL unless a database recovery decision has been explicitly approved and the recovery point is understood.
- Do not rotate secrets or certificates as part of a normal application rollback unless the incident specifically requires it.

Application rollback:

1. Select the previous known-good versioned RELEASE_TAG.
2. Re-deploy only the required application release using the approved deployment procedure.
3. Do not run destructive database migrations or reverse financial records as part of rollback.
4. Verify gateway health.
5. Verify customer and admin applications.
6. Verify authentication and read-only operational endpoints.
7. Verify service health and restart counts.
8. Review payment, wallet, reconciliation, outbox, and notification state without forcing replay or money movement.

Database boundary:

- Database restore is a last-resort recovery action, not a routine application rollback step.
- A schema change that is not backward-compatible requires its own reviewed rollback/migration plan before production release.
- Financial ledger and transaction state must remain authoritative and auditable.

Post-rollback:

- Preserve logs and incident evidence.
- Record the failed release tag and the restored release tag.
- Do not mark the incident resolved until application health and financial-integrity checks pass.
- If the rollback does not restore service safely, escalate using the incident and recovery runbook.
