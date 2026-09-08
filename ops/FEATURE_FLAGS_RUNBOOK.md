# Feature flags and gradual rollout

The API Gateway stores dynamic flag configuration in Redis under the versioned
namespace `payflow:feature-flags:v1:<flag-name>`. The current registered flags
are `offers-rewards`, `recharge-bill-payments`, `autopay-mandates`,
`bill-splitting`, and `request-money`. Unknown flag names are always disabled.

Each key contains JSON with this exact shape:

```json
{
  "enabled": true,
  "rolloutPercentage": 25,
  "rolloutSalt": "v1",
  "allowlist": [],
  "denylist": []
}
```

`enabled: false` is the emergency kill switch. `rolloutPercentage` must be an
integer from 0 through 100. Lists contain at most 1,000 stable user IDs, each
at most 128 characters; `rolloutSalt` is a 1–64-character deployment version
using letters, digits, `.`, `_`, or `-`. Do not store secrets, emails, or other
PII in the configuration.

Evaluation order is denylist, global disable, allowlist, 100%, 0%, then the
percentage bucket. The bucket is `SHA-256(flag-name + stable-user-id +
rollout-salt) mod 100`, so the result is stable across requests and API Gateway
replicas. Redis settings are shared state; the application has no process-local
authoritative flag cache. If Redis or a value is unavailable or malformed, the
Gateway uses the immutable registered default (enabled at 100%) to preserve the
frozen release behavior and emits a structured operational warning.

For a safe rollout, publish a valid configuration and move the percentage in
this order: 1%, 5%, 10%, 25%, 50%, 100%. Keep the salt unchanged during a
rollout. To roll back exposure, set `rolloutPercentage` to `0`; to disable the
feature entirely, set `enabled` to `false`. Changes should be made through the
approved, audited Redis operator path. Review Gateway structured logs and the
`payflow_gateway_feature_flag_evaluations_total` metric after each change.

Flags are only an additional Gateway gate. They must never bypass authentication,
authorization, wallet ownership checks, provider configuration, rate limiting,
risk controls, ledger protections, reconciliation, settlement, or payment
state protections. They are not a substitute for financial or compliance
controls.
