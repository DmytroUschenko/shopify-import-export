# Shopify Import App — General Plan

> **Status: ✅ APPROVED** — 2 April 2026

---

## Overview

Turborepo monorepo with two apps:
- `apps/web` — React Router v7 + Polaris (Shopify embedded admin panel)
- `apps/api` — NestJS + TypeORM (business logic, webhooks, import processing)

Shared TypeScript types live in `packages/shared` — these are **not** TypeORM entities but enums and payload interfaces used by both apps for type-safety. Shopify entity data flows INTO the app via webhooks (live) and on-demand bulk import (historical). Everything runs in Docker Compose.

---

## Key Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Monorepo | Turborepo + pnpm | Task caching, parallel builds, workspace protocol |
| Frontend | React Router v7 + Polaris + App Bridge | Shopify's official recommended stack for embedded apps |
| Backend | NestJS | Scalable module/DI system, TypeScript-native, grows cleanly |
| ORM | TypeORM | Native NestJS integration, decorator-based, PostgreSQL JSONB support |
| Database | PostgreSQL 16 | JSONB for raw Shopify payloads, ACID for audit history |
| Queue | BullMQ + Redis | Async webhook processing — guarantees <5s Shopify response SLA |
| Import strategy | Webhooks (live) + manual bulk import (historical) | No polling; webhooks are Shopify's recommended approach |
| DB schema | Two generic tables (`db_import`, `db_history`) | Entity-agnostic, extensible to any future entity types |
| Deploy | Docker Compose | All services containerized, portable, production-ready |

---

## Project Structure

```
shopify-import/
├── apps/
│   ├── web/                        # Shopify embedded app (React Router v7)
│   │   ├── app/
│   │   │   ├── shopify.server.ts   # shopifyApp() config, token exchange
│   │   │   ├── root.tsx            # AppProvider (Polaris + App Bridge)
│   │   │   └── routes/
│   │   │       ├── _index.tsx      # Dashboard
│   │   │       ├── auth.$.tsx      # OAuth entry
│   │   │       ├── import._index.tsx   # Bulk import trigger + progress
│   │   │       └── entities._index.tsx # Browse imported data
│   │   ├── shopify.app.toml
│   │   └── Dockerfile
│   └── api/                        # NestJS API
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── entities/
│       │   │   ├── shop.entity.ts
│       │   │   ├── db-import.entity.ts
│       │   │   └── db-history.entity.ts
│       │   └── modules/
│       │       ├── shopify/        # Webhook registration, token management
│       │       ├── webhook/        # POST /webhooks/:topic handler + HMAC
│       │       ├── import/         # BullMQ queues, processors, bulk import
│       │       ├── entities/       # GET /entities query endpoint
│       │       └── health/         # GET /health
│       └── Dockerfile
├── packages/
│   ├── shared/                     # EntityType enum, payload interfaces (OrderPayload, CustomerPayload, ...)
│   │   │                           # NOT TypeORM entities — these are plain TS types used in both apps
│   └── config/                     # tsconfig.base.json, eslint base
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── turbo.json
├── .env.example
└── .github/
    ├── copilot-instructions.md
    └── instructions/               # Populated by `npx skills add`
```

---

## Phase 1: Monorepo Skeleton

1. Init repo with `pnpm` workspaces: `apps/*`, `packages/*`
2. `turbo.json` — pipeline tasks: `build`, `dev`, `lint`, `typecheck`, `test`
3. `packages/shared/` — plain TypeScript types shared across both apps:
   - `EntityType` enum — `'order' | 'customer' | 'product' | 'fulfillment' | ...` (used as DB ENUM value and for query filters)
   - `ImportStatus` enum — `'received' | 'processing' | 'processed' | 'failed' | 'bulk_imported'`
   - Payload interfaces — `OrderPayload`, `CustomerPayload`, `ProductPayload` (type the `data: JSONB` column — prevents `any`)
   - **No TypeORM `@Entity` classes here** — those live only in `apps/api/src/entities/`
4. `packages/config/` — shared `tsconfig.base.json`, `.eslintrc.base.js`
5. Root `.gitignore`, `.env.example`

---

## Phase 2: Shopify Embedded App (`apps/web`)

Scaffold: `npx shopify app init` → React Router template.

**Scopes** (`shopify.app.toml`): `read_orders`, `read_customers`, `read_products`

**Auth**: token exchange strategy + Shopify managed installation (no redirect OAuth)

**Routes:**

| Route | Purpose |
|---|---|
| `_index.tsx` | Dashboard: recent import stats |
| `auth.$.tsx` | OAuth / token exchange entry point |
| `import._index.tsx` | Trigger bulk import per entity type + Polaris `ProgressBar` |
| `entities._index.tsx` | Browse `db_import` — `DataTable` with entity type / status filter |

Route loaders call `apps/api` via internal Docker network.

**Key packages:** `@shopify/shopify-app-react-router`, `@shopify/polaris`, `@shopify/app-bridge-react`, `react-router`

---

## Phase 3: NestJS API (`apps/api`)

### Database Schema

**`shops`** — one row per installed store
```
id            UUID PK
domain        VARCHAR UNIQUE        (e.g. mystore.myshopify.com)
access_token  VARCHAR
installed_at  TIMESTAMP
```

**`db_import`** — current state of each entity (upserted on every event)
```
id            UUID PK
shop_id       FK → shops
entity_id     VARCHAR               (Shopify GID)
entity_type   ENUM                  (order | customer | product | fulfillment | ...)
data          JSONB                 (raw Shopify payload — latest version)
status        ENUM                  (received | processing | processed | failed)
created_at    TIMESTAMP
updated_at    TIMESTAMP
UNIQUE (shop_id, entity_id, entity_type)
```

**`db_import_history`** — immutable audit log, one row per change event
```
id            UUID PK
shop_id       FK → shops
entity_id     VARCHAR
entity_type   ENUM
data          JSONB                 (payload snapshot at this moment)
status        VARCHAR               (Shopify-side status from payload)
created_at    TIMESTAMP             (from X-Shopify-Triggered-At header)
updated_at    TIMESTAMP
```

### TypeScript Types vs TypeORM Entities

> **Important distinction:**
> - `packages/shared` holds **plain TypeScript types** (`EntityType` enum, `OrderPayload`, etc.) — no decorators, no DB coupling, usable in both `apps/web` and `apps/api`.
> - `apps/api/src/entities/` holds **TypeORM `@Entity` classes** (`DbImportEntity`, `DbHistoryEntity`, `ShopEntity`) — only three, covering all Shopify entity types through the generic `data: JSONB` column.
> - There are **no** separate `OrderEntity`, `CustomerEntity`, or `ProductEntity` TypeORM classes. The `data` column stores the raw Shopify payload, typed via `OrderPayload | CustomerPayload | ProductPayload` from `packages/shared`.

### NestJS Modules

| Module | Responsibility |
|---|---|
| `ShopifyModule` | Register webhook subscriptions on install, manage access tokens |
| `WebhookModule` | `POST /webhooks/:topic` — HMAC validation, dedup, upsert, enqueue |
| `ImportModule` | BullMQ queues + processors; `BulkImportService` for GraphQL pagination |
| `EntitiesModule` | `GET /api/entities` — query `db_import` with filters |
| `HealthModule` | `GET /health` for Docker healthcheck |

**Other:** `ConfigModule` (typed env), `ShopAuthGuard` (validates `X-Shop-Domain` on non-webhook routes)

**Key packages:** `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/bullmq`, `bullmq`, `ioredis`, `@nestjs/config`, `@shopify/shopify-api`

---

## Phase 4: Import System

### 4A — Webhook-driven (real-time)

Subscribed topics registered on app install:
- `orders/create`, `orders/updated`
- `customers/create`, `customers/updated`
- `products/create`, `products/updated`

**Flow:**
1. Shopify fires `POST /webhooks/:topic`
2. Validate `X-Shopify-Hmac-Sha256` → 401 if invalid
3. Deduplicate via `X-Shopify-Event-Id` → skip if already seen
4. **Synchronously:** upsert `db_import` (`status=received`) + insert `db_history` row
5. Enqueue job to BullMQ `process-entity` queue
6. **Return HTTP 200 immediately** (Shopify requires response within 5 seconds)
7. Worker: `db_import.status` → `processing` → `processed`

### 4B — Bulk Import (on-demand, historical data)

1. Admin UI: "Import all" button per entity type
2. `POST /api/import/bulk { entityType }` → `BulkImportService`
3. Cursor-paginated GraphQL queries (250 records/page)
4. Per batch: upsert `db_import` + insert `db_history` (`status=bulk_imported`)
5. Progress tracked in BullMQ job → `GET /api/import/bulk/status/:jobId`
6. UI polls, shows Polaris `ProgressBar`

**Key files:**
- `apps/api/src/modules/webhook/webhook.controller.ts`
- `apps/api/src/modules/webhook/webhook.middleware.ts` (HMAC validation)
- `apps/api/src/modules/import/bulk-import.service.ts`
- `apps/api/src/modules/import/processors/entity.processor.ts`

---

## Phase 5: Docker Deployment

### Services (`docker-compose.yml`)

| Service | Image | Port | Notes |
|---|---|---|---|
| `postgres` | `postgres:16` | 5432 | Persistent volume, healthcheck |
| `redis` | `redis:7-alpine` | 6379 | BullMQ backend + event-id dedup |
| `api` | Custom Dockerfile | 3001 | Multi-stage Node 20 Alpine; depends_on postgres, redis |
| `web` | Custom Dockerfile | 3000 | Multi-stage Node 20 Alpine; depends_on api |
| `nginx` | `nginx:alpine` | 80/443 | `/api/*` → api:3001, `/*` → web:3000 |

### Dockerfile Pattern (both services)
```
Stage 1 — builder: node:20-alpine → install deps → build
Stage 2 — runner:  node:20-alpine → copy dist + node_modules → run as non-root
```

### Environment Variables (`.env.example`)
```
DATABASE_URL=postgresql://user:pass@postgres:5432/shopify_import
REDIS_URL=redis://redis:6379
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=https://your-app.example.com
```

---

## Phase 6: GitHub Copilot Instructions via Skills

Run from repo root after initial setup:

```bash
# React / Turborepo / UI — Vercel official
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices
npx skills add vercel-labs/agent-skills --skill turborepo
npx skills add vercel-labs/agent-skills --skill building-components
npx skills add vercel-labs/agent-skills --skill workflow

# Shopify — covers React Router, App Bridge, webhook HMAC, GraphQL over REST, anti-patterns
npx skills add https://github.com/sickn33/antigravity-awesome-skills --skill shopify-apps

# NestJS — 40 rules: architecture, DI, security, performance, DB/ORM, microservices
npx skills add https://github.com/kadajett/agent-nestjs-skills --skill nestjs-best-practices

# Docker — GitHub official: multi-stage builds, layer caching, security, healthchecks
npx skills add https://github.com/github/awesome-copilot --skill multi-stage-dockerfile

# TypeORM — entities, JSONB, migrations, NestJS integration, transactions, naming strategy
npx skills add https://github.com/mindrally/skills --skill typeorm
```

Each command installs a `.github/instructions/<skill>.instructions.md` file that Copilot reads automatically.

Create `.github/copilot-instructions.md` manually with project-specific context:
- Monorepo structure + which app owns what
- Naming conventions (entity types, module names)
- Environment variable patterns
- Webhook flow summary

---

## Verification Steps

1. `pnpm turbo run build` — all packages compile without errors
2. `docker-compose up` — all 5 services reach healthy state (`docker ps`)
3. `shopify app dev` in `apps/web` — embedded app loads inside Shopify admin iframe
4. Install on dev store → `shops` row created with access token
5. Fire `orders/create` test webhook → row in `db_import` + `db_history`, status=`processed`
6. Send duplicate webhook (same `X-Shopify-Event-Id`) → skipped, no duplicate rows
7. Trigger bulk import from admin UI → progress bar advances, historical rows appear in `db_import`
8. `GET /api/entities?type=order` → returns paginated JSONB records
9. `GET /health` → `{ "status": "ok" }`

---

## Out of Scope (Phase 1)

- Real-time UI updates (WebSockets / SSE)
- Multi-tenant billing / Shopify App Store listing
- Frontend and E2E testing setup
- CI/CD pipeline (GitHub Actions)
- Webhook dead-letter queue / delivery monitoring
- TypeORM migrations (auto-sync in dev; migrations required before any production deploy)
