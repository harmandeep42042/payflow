# 💳 Payflow

Enterprise-grade digital wallet and payment platform built using microservices architecture.

![TypeScript](https://img.shields.io/badge/TypeScript-6-blue)
![NestJS](https://img.shields.io/badge/NestJS-11-red)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-Enabled-orange)
![Nx](https://img.shields.io/badge/Nx-Monorepo-143055)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Overview

Payflow is a fintech platform inspired by digital wallet applications such as Paytm.

The project demonstrates how a modern backend can be designed using:

- Microservices
- API Gateway
- JWT authentication
- Role-based access control
- PostgreSQL
- Prisma ORM
- RabbitMQ
- Redis
- Docker
- Nx Monorepo
- Next.js frontend

The project currently includes wallet operations, authentication, notifications, API documentation, standardized responses, error handling, and request logging.

---

## Current Features

### Authentication

- User registration
- User login
- Password hashing with bcrypt
- JWT access token
- Refresh token rotation
- Logout and token revocation
- Protected profile route
- Input validation
- Swagger documentation

### Authorization

- Role-based access control
- USER role
- ADMIN role
- Admin-only routes
- User and admin shared routes
- JWT guards
- Roles guard

### Wallet Service

- Create wallet
- Find wallet by ID
- Find wallets by user
- Deposit funds
- Withdraw funds
- Wallet-to-wallet transfer
- Idempotency protection
- Optimistic locking
- Double-entry ledger
- Outbox event creation

### Notification Service

- RabbitMQ consumer
- Wallet event consumption
- Deposit event handling
- Transfer event handling
- Manual message acknowledgement

### API Gateway

- Auth service proxy
- Wallet service proxy
- Central API prefix
- Forwarded authentication headers
- Downstream error handling

### Developer Experience

- Swagger UI
- Global exception filter
- Standard success response format
- Request logging interceptor
- Docker Compose
- Shared Prisma database library
- Nx monorepo
- Git and GitHub workflow

---

## Architecture

```text
                         Client Applications
                    Next.js Web / Admin / Mobile
                                  |
                                  v
                         API Gateway :4000
                         /api/v1/*
                                  |
             +--------------------+--------------------+
             |                                         |
             v                                         v
     Auth Service :4002                        Wallet Service :4001
     /api/auth/*                               /api/v1/wallets/*
             |                                         |
             |                                         v
             |                                  PostgreSQL Database
             |                                         |
             |                                  Prisma ORM / Ledger
             |                                         |
             |                                         v
             |                                  OutboxEvent Table
             |                                         |
             +--------------------+--------------------+
                                  |
                                  v
                           RabbitMQ Broker
                                  |
                                  v
                      Notification Service Consumer
```

---

## Technology Stack

### Backend

- NestJS
- TypeScript
- Nx
- Prisma ORM
- PostgreSQL
- RabbitMQ
- Redis
- JWT
- Passport
- bcrypt
- Swagger
- Axios

### Frontend

- Next.js
- React
- Tailwind CSS

### Infrastructure

- Docker
- Docker Compose
- GitHub
- pnpm workspaces

---

## Project Structure

```text
payflow/
├── apps/
│   ├── api-gateway/
│   ├── wallet-service/
│   ├── web/
│   └── admin-web/
│
├── auth-service/
│
├── notification-service/
│
├── libs/
│   └── database/
│       └── src/
│           └── lib/
│               └── prisma/
│                   ├── prisma.module.ts
│                   └── prisma.service.ts
│
├── prisma/
│   ├── migrations/
│   └── schema.prisma
│
├── generated/
│   └── prisma/
│
├── tools/
│   └── create-admin.ts
│
├── docker-compose.yml
├── prisma.config.ts
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Prerequisites

Install these before starting:

- Node.js 24 or compatible version
- pnpm 11
- Git
- Docker Desktop
- VS Code

Verify:

```powershell
node -v
pnpm -v
git --version
docker --version
docker compose version
```

---

## Installation

Clone the repository:

```powershell
git clone https://github.com/harmandeep42042/payflow.git
cd payflow
```

Install dependencies:

```powershell
pnpm install
```

Approve required dependency build scripts when needed:

```powershell
pnpm approve-builds
```

---

## Environment Variables

Create a `.env` file in the project root.

```env
DATABASE_URL="postgresql://payflow:payflow_password@localhost:5433/payflow_db?schema=public"

RABBITMQ_URL="amqp://payflow:payflow_password@localhost:5672"
RABBITMQ_QUEUE="wallet_events"

JWT_SECRET="replace_with_a_long_secure_access_token_secret"
JWT_REFRESH_SECRET="replace_with_a_long_secure_refresh_token_secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

API_GATEWAY_PORT="4000"
AUTH_SERVICE_URL="http://localhost:4002/api"
WALLET_SERVICE_URL="http://localhost:4001/api/v1"
```

Do not commit the real `.env` file.

---

## Docker Services

Start all infrastructure services:

```powershell
docker compose up -d
```

Check status:

```powershell
docker compose ps
```

Expected services:

- PostgreSQL
- Redis
- RabbitMQ

RabbitMQ dashboard:

```text
http://localhost:15672
```

Development login:

```text
Username: payflow
Password: payflow_password
```

---

## Prisma Setup

Format the schema:

```powershell
pnpm exec prisma format
```

Validate the schema:

```powershell
pnpm exec prisma validate
```

Apply migrations:

```powershell
pnpm exec prisma migrate dev
```

Generate Prisma Client:

```powershell
pnpm exec prisma generate
```

Check migration status:

```powershell
pnpm exec prisma migrate status
```

Open Prisma Studio:

```powershell
pnpm exec prisma studio
```

---

## Running the Services

### Auth Service

```powershell
$env:PORT=4002
pnpm nx serve auth-service
```

Base URL:

```text
http://localhost:4002/api
```

Swagger:

```text
http://localhost:4002/swagger
```

### Wallet Service

```powershell
pnpm nx serve wallet-service
```

Base URL:

```text
http://localhost:4001/api/v1
```

### API Gateway

```powershell
pnpm nx serve api-gateway
```

Base URL:

```text
http://localhost:4000/api/v1
```

### Notification Service

```powershell
pnpm nx serve notification-service
```

The service listens to the RabbitMQ queue:

```text
wallet_events
```

---

## Main API Endpoints

### Auth Service

```text
GET  /api/auth/health
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/profile
GET  /api/auth/admin
GET  /api/auth/user
```

### Wallet Service

```text
GET  /api/v1/wallets
POST /api/v1/wallets
POST /api/v1/wallets/deposit
POST /api/v1/wallets/withdraw
POST /api/v1/wallets/transfer
GET  /api/v1/wallets/user/:userId
GET  /api/v1/wallets/:walletId
```

### API Gateway

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/profile

GET  /api/v1/wallets/:walletId
GET  /api/v1/wallets/user/:userId
POST /api/v1/wallets/deposit
POST /api/v1/wallets/withdraw
POST /api/v1/wallets/transfer
```

---

## Create Development Admin

Run:

```powershell
pnpm exec tsx .\tools\create-admin.ts
```

Development credentials:

```text
Email: admin@payflow.com
Password: Admin@123
```

Change these credentials before any production deployment.

---

## Build Commands

Build Auth Service:

```powershell
pnpm nx build auth-service
```

Build Wallet Service:

```powershell
pnpm nx build wallet-service
```

Build API Gateway:

```powershell
pnpm nx build api-gateway
```

Build Notification Service:

```powershell
pnpm nx build notification-service
```

Show all Nx projects:

```powershell
pnpm nx show projects
```

Reset Nx cache:

```powershell
pnpm nx reset
```

---

## Security Features

- Password hashing with bcrypt
- JWT access token
- Hashed refresh tokens
- Refresh token rotation
- Token revocation
- Role-based authorization
- ValidationPipe
- Standard exception handling
- Idempotency keys
- Optimistic locking
- Double-entry ledger
- Outbox pattern

---

## Planned Features

- Redis-backed rate limiting
- OTP login
- Email verification
- SMS notifications
- Firebase push notifications
- Transaction history API
- Audit service
- Fraud detection rules
- Prometheus metrics
- Grafana dashboards
- Production Docker configuration
- Kubernetes manifests
- GitHub Actions CI/CD
- AWS deployment
- Next.js customer dashboard
- Admin dashboard

---

## Git Workflow

Stage changes:

```powershell
git add .
```

Commit:

```powershell
git commit -m "Describe the completed feature"
```

Push:

```powershell
git push origin main
```

---

## Disclaimer

This project is currently intended for learning, development, and portfolio demonstration.

It is not ready for handling real money without additional security audits, regulatory compliance, testing, monitoring, operational controls, and infrastructure hardening.

---

## Author

**Harman Deep**

- GitHub: `harmandeep42042`
- Project: Payflow

---

## License

This project is licensed under the MIT License.