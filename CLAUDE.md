# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skills

Use the skills in `.agents/skills/` when working in relevant areas:

- `nestjs-best-practices` — NestJS modules, DI, architecture patterns (use when editing `apps/api/`)
- `typeorm` — TypeORM entities, migrations, queries (use when editing database models)
- `shopify-apps` — Shopify app patterns, React Router integration (use when editing `apps/web/`)
- `multi-stage-dockerfile` — Optimized multi-stage Docker builds
- `vercel-react-best-practices` — React/Vite performance patterns
- `devops-engineer` — Deployment, Docker Compose, infrastructure

## Overview

This is a **pnpm monorepo** for a Shopify embedded app with bulk import functionality. It uses **Turbo** for task orchestration across two apps and two shared packages.

- `apps/api` — NestJS backend (port 3001): REST API, TypeORM + PostgreSQL, BullMQ job queue
- `apps/web` — React Router 7 frontend (port 3000): Shopify Polaris UI, embedded admin app
- `packages/shared` — Shared TypeScript types, enums, and payload definitions
- `packages/config` — Shared TypeScript and ESLint base configs

**Requirements**: Node >=20.0.0, pnpm >=9.0.0

## Commands

### Root (via Turbo)
```bash
pnpm dev          # Start all dev servers with hot-reload
pnpm build        # Build all packages in dependency order
pnpm lint         # ESLint across workspace
pnpm typecheck    # TypeScript type checking across workspace
pnpm test         # Run tests across workspace
pnpm format       # Prettier format (TS, TSX, JSON, MD)
```

### Filtered (single app)
```bash
pnpm --filter=@shopify-import/api dev
pnpm --filter=@shopify-import/web dev
pnpm --filter=@shopify-import/api build
```

### Docker / Deployment
```bash
make dev          # Local dev with hot-reload (docker-compose.dev.yml)
make dev-down     # Stop dev containers
make deploy       # First-time production deploy (copies .env, builds, starts)
make redeploy     # git pull → rebuild all → restart
make redeploy-api # git pull → rebuild api → restart
make health       # Check /health endpoint
make logs-api     # Tail API logs
make db-shell     # Open psql shell
```

## Architecture

### Service topology
```
nginx (8080) → /api/* → api:3001 (NestJS)
             → /*     → web:3000 (React Router)
api → postgres:5432, redis:6379
web → postgres:5432 (session storage), api:3001
```

### API module structure (`apps/api/src/`)
- `app.module.ts` — Root module wiring TypeORM, BullMQ, Config, Health, Import, Entities, Webhook
- `modules/health/` — `GET /health` endpoint
- `modules/webhook/` — Shopify webhook receiver with HMAC validation
- `modules/import/` — Bulk import orchestration via BullMQ (`bulk-import` queue)
- `modules/entities/` — Entity statistics and listing
- `entities/` — TypeORM models: `Shop`, `DbImport`, `DbHistory`

### Web route structure (`apps/web/app/routes/`)
- `root.tsx` — App wrapper with Shopify AppProvider and Polaris
- `_index.tsx` — Dashboard with entity import stats
- `import._index.tsx` — Import management UI
- `entities._index.tsx` — Entity listing
- `auth.$.tsx` — OAuth splat route

### Shared types (`packages/shared/src/`)
- `enums.ts` — `EntityType` (Order, Customer, Product, Fulfillment, Refund, Collection), `ImportStatus` (Received → Processing → Processed/Failed/BulkImported)
- `index.ts` — Re-exports all shared types and payloads

### Job queue
BullMQ backed by Redis. The `bulk-import` queue processes entity imports asynchronously. Jobs track progress percentage and are cleaned up after 25 completed/failed jobs.

### Environment configuration
Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`
- `TYPEORM_SYNCHRONIZE=true` — set to false in production (use migrations)
- `API_PORT=3001`, `WEB_PORT=3000`

### Docker build pattern
Both apps use multi-stage builds: **builder** (compile TS, extract prod deps) → **runner** (copy only prod files, non-root uid 1001).

Development containers (`docker-compose.dev.yml`) use `ts-node-dev` (API) and Vite HMR (web) with source-mounted volumes for hot-reload. Production (`docker-compose.yml`) runs compiled output.

### Shopify app config
`apps/web/shopify.app.toml` defines the app manifest (client_id, webhook API version 2026-04, access scopes). The `application_url` must match the ngrok tunnel in development.

### ⚠️ Shopify requires a clean domain — subpaths do not work
`SHOPIFY_APP_URL` must be a **bare domain** (e.g. `https://uho.kharkiv.ua`), never a subpath like `https://uho.kharkiv.ua/shopify`. Shopify embedded apps are loaded in an iframe and the OAuth/auth redirect flow breaks when the app is mounted under a path prefix. The same URL must be set in the Shopify Partners dashboard as the App URL. If the server hosts multiple apps under one domain, each Shopify app needs its own subdomain (e.g. `shopify.uho.kharkiv.ua`).

**nginx requirement**: the location block proxying to the Shopify app must NOT set `X-Frame-Options`. Declaring `add_header` in a child location block overrides all `add_header` directives from the parent server block, so re-declare other security headers explicitly.
