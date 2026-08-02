# Database Library

This library provides the shared database layer for the Payflow microservices.

## Features

- Prisma Client
- Prisma Service
- Global Prisma Module
- PostgreSQL Connection
- Shared Database Access

## Structure

```text
src/
│
├── index.ts
│
└── lib/
    │
    ├── database.spec.ts
    │
    └── prisma/
        │
        ├── prisma.module.ts
        └── prisma.service.ts
```

## Usage

Import the PrismaModule into your NestJS module.

```ts
import { PrismaModule } from '@payflow/database';

@Module({
  imports: [PrismaModule],
})
export class AppModule {}
```

Inject the PrismaService wherever database access is required.

```ts
constructor(
  private readonly prisma: PrismaService,
) {}
```

Example:

```ts
const users = await this.prisma.user.findMany();
```

## Exported Members

- PrismaModule
- PrismaService

## Technology

- Prisma ORM
- PostgreSQL
- NestJS
- TypeScript

## Author

Payflow Project