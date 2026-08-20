param(
    [Parameter(Mandatory = $true)]
    [string]$ApiGatewayUrl
)

$ErrorActionPreference = "Stop"

Write-Host "`n===== PAYFLOW FRONTEND PRODUCTION BUILD =====`n" -ForegroundColor Cyan

if (
    -not $ApiGatewayUrl.StartsWith("http://") -and
    -not $ApiGatewayUrl.StartsWith("https://")
) {
    throw "ApiGatewayUrl must start with http:// or https://"
}

$ApiGatewayUrl =
    $ApiGatewayUrl.TrimEnd("/")

Write-Host "API URL: $ApiGatewayUrl"

# NEXT_PUBLIC values must exist while Next.js is building.
$env:NEXT_PUBLIC_API_GATEWAY_URL =
    $ApiGatewayUrl

# sessions/page.tsx currently also supports this variable.
$env:NEXT_PUBLIC_API_URL =
    $ApiGatewayUrl

Write-Host "`n===== BUILD CUSTOMER =====" -ForegroundColor Yellow

pnpm nx build web --skip-nx-cache

if ($LASTEXITCODE -ne 0) {
    throw "CUSTOMER BUILD FAILED."
}

Write-Host "CUSTOMER BUILD: PASS" -ForegroundColor Green


Write-Host "`n===== BUILD ADMIN =====" -ForegroundColor Yellow

pnpm nx build admin-web --skip-nx-cache

if ($LASTEXITCODE -ne 0) {
    throw "ADMIN BUILD FAILED."
}

Write-Host "ADMIN BUILD: PASS" -ForegroundColor Green


Write-Host "`n===== BUILD CUSTOMER IMAGE =====" -ForegroundColor Yellow

docker build `
    -f ".\docker\Dockerfile.web" `
    -t "payflow-web:test" `
    .

if ($LASTEXITCODE -ne 0) {
    throw "CUSTOMER IMAGE BUILD FAILED."
}

Write-Host "CUSTOMER IMAGE: PASS" -ForegroundColor Green


Write-Host "`n===== BUILD ADMIN IMAGE =====" -ForegroundColor Yellow

docker build `
    -f ".\docker\Dockerfile.admin-web" `
    -t "payflow-admin-web:test" `
    .

if ($LASTEXITCODE -ne 0) {
    throw "ADMIN IMAGE BUILD FAILED."
}

Write-Host "ADMIN IMAGE: PASS" -ForegroundColor Green


Write-Host "`n============================================"
Write-Host " FRONTEND PRODUCTION BUILD COMPLETE"
Write-Host "============================================" -ForegroundColor Green