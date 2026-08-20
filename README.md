# Payflow

Payflow is a full-stack digital wallet and payment platform built with a
microservices architecture. It provides customer wallet operations,
money transfers, transaction history, authentication, administrative
management, analytics, audit logging, and real-time notifications.

The project is organized as an Nx monorepo and uses Next.js for the web
applications, NestJS for backend services, PostgreSQL with Prisma for
persistent data, Redis for fast temporary/session-related data, RabbitMQ
for asynchronous messaging, Socket.IO for real-time communication, and
Docker for containerized deployment.

## Release

Current stable release:

`v1.0.0`

The release has been tested using production Docker containers,
service restart tests, infrastructure outage/recovery tests,
authentication tests, wallet integrity checks, real-time notification
tests, customer flows, and admin flows.

---

## Main Features

### Customer Application

Customers can:

- Sign in securely
- View their dashboard
- View wallet information and balances
- Send money to another Payflow user
- Deposit funds
- Withdraw funds
- View transaction history
- View transaction details
- Manage their profile
- Edit profile information
- Change password
- Recover/reset password
- View and manage active sessions
- Configure notification preferences
- Receive real-time notifications

### Admin Application

Administrators can:

- Sign in using an ADMIN account
- View platform analytics
- View users
- Inspect individual user details
- Review wallet information
- Review transactions
- Inspect transaction details
- Review audit logs
- Monitor important platform activity

### Backend

The backend includes:

- API Gateway
- Authentication Service
- Wallet Service
- Payment Service
- Notification Service
- PostgreSQL database
- Redis
- RabbitMQ
- Prisma ORM
- JWT authentication
- Role-based access control
- Real-time Socket.IO notifications
- Audit logging
- Dockerized production deployment

---

## Architecture

```text
                         +----------------------+
                         |    Customer Web      |
                         |      Next.js         |
                         |       :3000          |
                         +----------+-----------+
                                    |
                                    |
                         +----------v-----------+
                         |     API Gateway      |
                         |       NestJS         |
                         |       :4000          |
                         +----+----+----+-------+
                              |    |    |
               +--------------+    |    +----------------+
               |                   |                     |
       +-------v-------+   +-------v-------+     +-------v--------+
       | Auth Service  |   | Wallet Service|     | Payment Service|
       |    NestJS     |   |    NestJS     |     |     NestJS     |
       |     :4002     |   |     :4001     |     |      :4005     |
       +-------+-------+   +-------+-------+     +----------------+
               |                   |
               |                   |
               +---------+---------+
                         |
                 +-------v--------+
                 |   PostgreSQL   |
                 |    Prisma      |
                 +----------------+

                 +----------------+
                 |     Redis      |
                 +----------------+

                 +----------------+
                 |    RabbitMQ    |
                 +-------+--------+
                         |
                 +-------v----------------+
                 | Notification Service   |
                 | NestJS + Socket.IO     |
                 |         :4006          |
                 +-----------+------------+
                             |
                             |
                   Real-time notifications
                             |
                 +-----------v------------+
                 | Customer Web / Gateway |
                 +------------------------+


                         +----------------------+
                         |      Admin Web       |
                         |       Next.js        |
                         |        :3001         |
                         +----------+-----------+
                                    |
                                    v
                              API Gateway
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Monorepo | Nx |
| Customer Frontend | Next.js, React |
| Admin Frontend | Next.js, React |
| Backend | NestJS |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache / temporary data | Redis |
| Message Broker | RabbitMQ |
| Real-time Communication | Socket.IO |
| Authentication | JWT |
| Password Security | bcrypt |
| API Validation | class-validator |
| Security Headers | Helmet |
| Payment Integration | Razorpay |
| Containers | Docker / Docker Compose |
| Charts | Recharts |

---

## Applications and Services

### Customer Web

```text
apps/web
```

Default development/production host port:

```text
3000
```

Important customer routes include:

```text
/
 /login
 /dashboard
 /send-money
 /transfer
 /transfer-success
 /deposit
 /withdraw
 /transactions
 /profile
 /edit-profile
 /change-password
 /forgot-password
 /reset-password
 /sessions
 /notification-settings
```

### Admin Web

```text
apps/admin-web
```

Default host port:

```text
3001
```

The admin application provides management interfaces for users,
transactions, analytics and audit information.

### API Gateway

```text
apps/api-gateway
```

Public API port:

```text
4000
```

The API Gateway acts as the main backend entry point and routes requests
to internal services.

### Authentication Service

```text
auth-service
```

Internal port:

```text
4002
```

Responsibilities include:

- Login
- Registration/authentication flows
- JWT access tokens
- Refresh-token rotation
- Password management
- Session management
- OTP-related authentication
- Role information
- Authentication security controls

### Wallet Service

```text
apps/wallet-service
```

Internal port:

```text
4001
```

Responsibilities include:

- Wallet management
- Balance management
- Transfers
- Deposits
- Withdrawals
- Transaction history
- Ledger operations
- Recipient lookup
- Outbox events
- Administrative wallet operations

### Payment Service

```text
apps/payment-service
```

Internal port:

```text
4005
```

Responsibilities include payment-order and provider-related operations.

### Notification Service

```text
notification-service
```

Internal port:

```text
4006
```

Responsibilities include:

- Notification persistence
- RabbitMQ event consumption
- Notification preferences
- Real-time Socket.IO delivery
- Authenticated WebSocket connections

---

## Production Network Model

Only the user-facing applications and API Gateway are exposed to the host.

```text
Customer Web       -> 3000
Admin Web          -> 3001
API Gateway        -> 4000
```

Core backend services remain internal to the Docker network:

```text
Auth Service         4002
Wallet Service       4001
Payment Service      4005
Notification Service 4006
PostgreSQL           5432
Redis                6379
RabbitMQ             5672
```

This reduces unnecessary public exposure of internal services.

---

## Database

Payflow uses PostgreSQL with Prisma.

Important domain entities include areas such as:

```text
User
Wallet
Transfer
Deposit
Withdrawal
Payment
LedgerAccount
LedgerEntry
RefreshToken
Notification
NotificationPreference
NotificationLog
OutboxEvent
AuditLog
```

Wallet operations use persistent ledger/database records rather than
keeping financial state only in application memory.

---

## Authentication and Security

Payflow includes multiple security controls.

### JWT

Authentication uses access and refresh tokens.

Refresh-token handling includes token rotation and rejection of reused
old refresh tokens.

Production JWT secrets are provided through environment variables rather
than hard-coded production fallback values.

### Role-Based Access Control

Administrative routes require an authenticated user with the appropriate
ADMIN role.

### HTTP Security

Helmet is used to provide security-related HTTP headers.

Express technology disclosure through `X-Powered-By` is disabled on
hardened services.

### CORS

Allowed browser origins are controlled using an origin allowlist.

Example development origins:

```text
http://localhost:3000
http://localhost:3001
```

### WebSocket Security

Notification WebSocket connections require authentication.

Controls include:

- JWT verification
- Refresh-token rejection
- Origin validation
- Rejection of unauthenticated sockets
- Rejection of invalid JWTs

### Environment Secrets

Production secrets must remain outside Git.

Examples include:

```text
DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
RABBITMQ_URL
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
```

Do not commit `.env.production.local`.

---

## Messaging and Real-Time Notifications

Payflow uses RabbitMQ for asynchronous communication.

A typical flow is:

```text
Wallet operation
      |
      v
Database transaction
      |
      v
Outbox event
      |
      v
RabbitMQ
      |
      v
Notification Service
      |
      v
Socket.IO
      |
      v
Customer browser
```

This separates core wallet processing from real-time notification
delivery.

---

## Reliability Testing

The production stack has been tested for several failure and recovery
scenarios.

### Redis Recovery

The test verified that:

- Redis could be stopped
- Authentication returned a controlled service-unavailable response
- Auth service remained alive
- Redis could recover
- Authentication worked again after recovery

### RabbitMQ Recovery

The test verified that:

- RabbitMQ could be stopped
- Wallet HTTP health remained available
- Services detected broker disconnection
- RabbitMQ could recover
- Wallet and notification functionality recovered

### PostgreSQL Recovery

The test verified that:

- PostgreSQL could be stopped
- Database-dependent authentication returned HTTP 503
- Auth service survived the outage
- PostgreSQL recovered
- Login worked after recovery
- Wallet data remained intact

### Full Stack Restart

The entire production stack was stopped and recreated.

After restart:

- PostgreSQL was healthy
- Redis was healthy
- RabbitMQ was healthy
- Auth was available
- Wallet was available
- Payment was available
- Notification realtime communication was available
- Customer web was available
- Admin web was available
- Existing wallet data remained intact

---

## Verified Customer Transfer Flow

An end-to-end customer transfer test verified the following sequence:

```text
Customer Login
      |
      v
Recipient Resolution
      |
      v
Wallet Transfer
      |
      v
Debit Ledger Entry
      |
      v
Credit Ledger Entry
      |
      v
Transaction History
      |
      v
Outbox / Notification Processing
```

The test also verified that sender and recipient wallet balances changed
by the expected amount.

---

## Development Requirements

Install:

- Node.js
- pnpm
- Git
- Docker Desktop

The project uses an Nx workspace.

Install dependencies:

```bash
pnpm install
```

---

## Environment Configuration

Create your local environment configuration from a safe template.

Example variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@postgres:5432/payflow_db

JWT_SECRET=replace-with-secure-secret
JWT_REFRESH_SECRET=replace-with-another-secure-secret

REDIS_URL=redis://redis:6379

RABBITMQ_URL=amqp://USER:PASSWORD@rabbitmq:5672
RABBITMQ_QUEUE=wallet_events

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

Never use these example values as real production secrets.

---

## Build

Examples:

```bash
pnpm nx build web
pnpm nx build admin-web
pnpm nx build api-gateway
pnpm nx build auth-service
pnpm nx build wallet-service
pnpm nx build payment-service
pnpm nx build notification-service
```

---

## Docker Production Stack

Validate the production Compose configuration:

```bash
docker compose \
  --env-file .env.production.local \
  -f docker-compose.prod.yml \
  -p payflow \
  config
```

Start the stack:

```bash
docker compose \
  --env-file .env.production.local \
  -f docker-compose.prod.yml \
  -p payflow \
  up -d
```

View services:

```bash
docker compose \
  --env-file .env.production.local \
  -f docker-compose.prod.yml \
  -p payflow \
  ps
```

Stop the stack:

```bash
docker compose \
  --env-file .env.production.local \
  -f docker-compose.prod.yml \
  -p payflow \
  down
```

---

## Local URLs

After the production stack is running:

```text
Customer Application
http://localhost:3000

Admin Application
http://localhost:3001

API Gateway
http://localhost:4000
```

Internal microservices should normally be accessed through the API
Gateway rather than exposed directly to clients.

---

## Project Structure

A simplified structure is:

```text
payflow/
|
+-- apps/
|   +-- web/
|   +-- admin-web/
|   +-- api-gateway/
|   +-- wallet-service/
|   +-- payment-service/
|
+-- auth-service/
|
+-- notification-service/
|
+-- libs/
|   +-- database/
|   +-- shared-events/
|   +-- ...
|
+-- docker/
|
+-- docker-compose.prod.yml
|
+-- package.json
+-- pnpm-lock.yaml
+-- nx.json
+-- README.md
```

---

## Important Design Decisions

### Why an API Gateway?

The frontend does not need to know the location of every microservice.
The gateway provides a single public backend entry point.

### Why PostgreSQL?

Wallets, transfers and ledger information require reliable relational
storage and transactional consistency.

### Why Prisma?

Prisma provides type-safe database access and schema/migration tooling.

### Why Redis?

Redis is useful for fast temporary state and authentication-related
operations where persistent relational queries are unnecessary.

### Why RabbitMQ?

RabbitMQ decouples asynchronous work such as wallet events and
notifications from the main request lifecycle.

### Why Socket.IO?

Socket.IO allows Payflow to deliver real-time notifications to
authenticated users.

### Why Docker?

Docker provides repeatable runtime environments for the applications,
microservices and infrastructure dependencies.

### Why Nx?

Nx manages multiple frontend applications, backend services and shared
libraries inside one monorepo.

---

## Release Verification

Payflow `v1.0.0` passed:

- Production builds
- Docker image builds
- Docker Compose validation
- Full-stack cold start
- Customer authentication
- Admin authentication
- Customer core-flow testing
- Real wallet transfer testing
- Admin API integration
- WebSocket authentication
- WebSocket origin protection
- HTTP security checks
- Redis outage/recovery
- RabbitMQ outage/recovery
- PostgreSQL outage/recovery
- Data-integrity checks
- Customer UI walkthrough
- Admin UI walkthrough

---

## Future Improvements

Possible future versions can add:

- Cloud deployment
- CI/CD pipeline
- Automated integration test suite
- Observability and metrics
- Distributed tracing
- Centralized logging
- Additional payment providers
- Mobile application
- Advanced fraud detection
- Two-factor authentication
- Kubernetes deployment
- Production domain and TLS termination

These are future enhancements and are not required for the current
`v1.0.0` release.

---

## Disclaimer

Payflow is an educational/portfolio payment-system project.

A real production financial platform requires additional regulatory,
security, compliance, infrastructure, operational and financial controls
before handling real customer money.

---

## Author

**Harmandeep Singh**

Full-stack software development project focused on modern web
applications, backend microservices, payment architecture, containerized
infrastructure and real-time systems.

---

## License

MIT
