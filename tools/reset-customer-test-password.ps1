param(
  [string]$FixturePath = '.\e2e-login.json'
)

$ErrorActionPreference = 'Stop'

$credential = Get-Content -LiteralPath $FixturePath -Raw | ConvertFrom-Json
$email = [string]$credential.email
$password = [string]$credential.password

if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($password)) {
  throw 'The local customer fixture must contain an email and password.'
}

$lookupSql = @'
SELECT "id", "role", "status"
FROM "User"
WHERE lower("email") = lower(:'target_email');
'@

$target = $lookupSql |
  docker exec -i payflow_prod_postgres psql `
    -U payflow `
    -d payflow_db `
    -v "target_email=$email" `
    -At `
    -F '|'

if ($LASTEXITCODE -ne 0) {
  throw 'Unable to verify the local customer test account.'
}

$targetParts = @($target -split '\|')

if ($targetParts.Count -ne 3 -or $targetParts[1] -ne 'USER' -or $targetParts[2] -ne 'ACTIVE') {
  throw 'Target must be an existing active customer test user.'
}

$passwordHash = $password |
  docker exec -i payflow_prod_auth node -e `
    "const bcrypt=require('bcrypt');let value='';process.stdin.on('data',chunk=>value+=chunk);process.stdin.on('end',async()=>process.stdout.write(await bcrypt.hash(value.trimEnd(),12)));"

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($passwordHash)) {
  throw 'Unable to hash the local customer test password.'
}

$updateSql = @'
UPDATE "User"
SET "passwordHash" = :'new_hash'
WHERE "id" = :'target_id'
  AND "role" = 'USER'
  AND "status" = 'ACTIVE'
RETURNING "id";
'@

$updated = $updateSql |
  docker exec -i payflow_prod_postgres psql `
    -U payflow `
    -d payflow_db `
    -v "target_id=$($targetParts[0])" `
    -v "new_hash=$passwordHash" `
    -At

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($updated)) {
  throw 'The local customer test password was not updated.'
}

Write-Output 'target_user_confirmed = true'
Write-Output 'password_hash_updated = true'
