param(
  [string]$FixturePath = '.\e2e-login.json',
  [string]$Email
)

$ErrorActionPreference = 'Stop'

$email = if ([string]::IsNullOrWhiteSpace($Email)) {
  $credential = Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json
  [string]$credential.email
} else {
  $Email.Trim().ToLowerInvariant()
}
$localPart = ($email -split '@', 2)[0].Trim().ToLowerInvariant()

if ($localPart -notmatch '^[a-z0-9._-]+$') {
  throw 'The customer fixture email cannot produce a valid Payflow VPA.'
}

$vpa = "$localPart@payflow"

$sql = @'
UPDATE "User"
SET "vpa" = :'target_vpa'
WHERE lower("email") = lower(:'target_email')
  AND "role" = 'USER'
  AND "status" = 'ACTIVE'
  AND ("vpa" IS NULL OR "vpa" = :'target_vpa')
RETURNING "id";
'@

$updated = $sql |
  docker exec -i payflow_prod_postgres psql `
    -U payflow `
    -d payflow_db `
    -v "target_email=$email" `
    -v "target_vpa=$vpa" `
    -At

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($updated)) {
  throw 'The active customer fixture VPA was not updated.'
}

Write-Output 'target_user_confirmed = true'
Write-Output 'customer_vpa_ready = true'
