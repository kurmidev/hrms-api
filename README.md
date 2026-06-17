# IGreen HRMS — Backend API

Enterprise Human Resource Management System for IGreen Technologies, built with NestJS + MySQL + Prisma.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 (TypeScript) |
| Database | MySQL 8 via Prisma 5 ORM |
| Cache / Queue | Redis 7 (ioredis) + BullMQ |
| File Storage | MinIO (self-hosted S3) |
| Auth | JWT (access 15m + refresh 30d) + Passport |
| SMS OTP | Fast2SMS |
| Push Notifications | Firebase FCM |
| API Docs | Swagger at `/docs` |
| Deployment | Docker Compose |

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for MySQL, Redis, MinIO)
- npm 10+

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values (see Environment Variables section below)
```

### 3. Start infrastructure services

```bash
docker-compose up -d mysql redis minio
```

### 4. Run database migration

```bash
npm run prisma:migrate
```

### 5. Seed system roles and default admin

```bash
npm run prisma:seed
```

Default admin credentials after seeding:
- **Email:** `admin@igreentec.in`
- **Password:** `Admin@1234`

### 6. Start the API server

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

API runs on `http://localhost:3001`  
Swagger docs at `http://localhost:3001/docs` (non-production only)

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```env
# Application
PORT=3001
NODE_ENV=development
API_PREFIX=api/v1
APP_URL=http://localhost:3001

# Database (MySQL)
DATABASE_URL="mysql://hrms_user:hrms_pass@localhost:3306/hrms_db"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=change_this_to_a_long_random_secret_in_production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# MinIO (file storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=hrms-files

# SMS (Fast2SMS — only required in production)
FAST2SMS_API_KEY=

# Firebase FCM (push notifications)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Rate limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

## Available Scripts

```bash
npm run start:dev          # Start with hot-reload
npm run build              # Compile TypeScript
npm run start:prod         # Start compiled build

npm run prisma:generate    # Regenerate Prisma client
npm run prisma:migrate     # Run pending migrations (dev)
npm run prisma:migrate:prod # Apply migrations (production)
npm run prisma:seed        # Seed system roles and default admin
npm run prisma:studio      # Open Prisma Studio (GUI)

npm run lint               # ESLint
npm run format             # Prettier
npm run test               # Unit tests
npm run test:cov           # Test coverage
```

## Project Structure

```
src/
├── common/
│   ├── decorators/        # @Public, @CurrentUser, @RequirePermissions, @OrganizationId
│   ├── filters/           # HttpExceptionFilter (structured error responses)
│   ├── guards/            # JwtAuthGuard, PermissionsGuard (applied globally)
│   ├── interceptors/      # TransformInterceptor, LoggingInterceptor
│   ├── middleware/        # TenantMiddleware (extracts X-Organization-ID header)
│   ├── dto/               # PaginationDto, PaginatedResult
│   └── swagger/           # Reusable Swagger decorator utilities
├── config/
│   └── configuration.ts   # Typed config from environment variables
├── modules/
│   ├── auth/              # Login, OTP, refresh, logout, change-password, sessions
│   └── roles/             # Role CRUD, permission assignment, user-role management
├── prisma/                # PrismaService + global PrismaModule
└── redis/                 # RedisService + global RedisModule
prisma/
├── schema.prisma          # All 35+ data models
├── seed.ts                # System roles + default admin seed
└── migrations/            # Generated SQL migrations
```

## API Overview

All endpoints are prefixed with `/api/v1`. Full interactive docs at `/docs`.

### Authentication (`/api/v1/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Email + password login |
| POST | `/auth/otp/send` | Public | Send OTP to phone |
| POST | `/auth/otp/verify` | Public | Verify OTP and get tokens |
| POST | `/auth/refresh` | Public | Rotate access + refresh tokens |
| POST | `/auth/logout` | JWT | Logout current session |
| GET | `/auth/me` | JWT | Get current user profile + permissions |
| POST | `/auth/device-token` | JWT | Register FCM device token |
| PUT | `/auth/change-password` | JWT | Change password (revokes all sessions) |
| GET | `/auth/sessions` | JWT | List all active sessions |
| DELETE | `/auth/sessions` | JWT | Logout from all devices |
| DELETE | `/auth/sessions/:id` | JWT | Terminate specific session |

### Roles & Permissions (`/api/v1/roles`)

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/roles` | `role:create` | Create custom role |
| GET | `/roles` | `role:read` | List all org roles |
| GET | `/roles/:id` | `role:read` | Get role by ID |
| PUT | `/roles/:id` | `role:update` | Update role permissions |
| DELETE | `/roles/:id` | `role:delete` | Delete role |
| POST | `/roles/assign` | `role:assign` | Assign role to user |
| DELETE | `/roles/assign/:userId/:roleId` | `role:assign` | Remove role from user |
| GET | `/roles/users/:userId` | `role:read` | Get all roles for a user |

## Multi-Tenancy

Every request must include the `X-Organization-ID` header. The `TenantMiddleware` extracts it and attaches it to `req.organizationId`. All DB queries are scoped to this organization ID.

## Authentication Flow

```
Client → POST /auth/login → { accessToken (15m), refreshToken (30d) }
Client → Authorization: Bearer <accessToken> → protected routes
Client → POST /auth/refresh → new token pair (old refresh revoked)
Client → POST /auth/logout → refresh token deleted from Redis
```

Account lockout: 5 failed password attempts locks the account for 15 minutes.

## System Roles

Seeded automatically by `npm run prisma:seed`:

| Role | Key Permissions |
|---|---|
| `super_admin` | All permissions (`*`) |
| `org_admin` | All org-level operations |
| `hr_manager` | Employee, leave, onboarding, exit, reports |
| `finance_manager` | Payroll, loans, reports |
| `dept_manager` | Team leave approval, attendance, tasks |
| `field_supervisor` | Attendance, field task approval |
| `employee` | Self-service — leave apply, check-in, tasks |
| `it_admin` | Assets, service requests, user accounts |

## Docker Compose

```bash
# Start all services
docker-compose up -d

# Start only infrastructure (DB, Redis, MinIO)
docker-compose up -d mysql redis minio

# View logs
docker-compose logs -f hrms-api

# Stop all
docker-compose down
```

Services:
- **hrms-api** → port 3001
- **mysql** → port 3306 (database: `hrms_db`)
- **redis** → port 6379
- **minio** → port 9000 (API), 9001 (console)
- **nginx** → port 80/443 (reverse proxy)

## Swagger

Interactive API documentation is available at `/docs` in development and staging environments. Each endpoint documents:
- Request body schema with examples
- All possible response codes with example payloads
- Authentication requirements
- Permission requirements
