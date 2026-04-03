# Shopify Import App — Docker Solution

## Goal

This document turns Phase 5 into a runnable container stack for the approved Shopify Import architecture. It covers database creation, service-to-service networking, startup order, and the minimum backend scaffold required for the existing web app to run inside Docker.

## Runtime Topology

### Services

| Service | Purpose | Internal Port | Depends on |
|---|---|---:|---|
| `postgres` | Primary database for Shopify sessions and import data | 5432 | None |
| `redis` | BullMQ backend and transient queue state | 6379 | None |
| `api` | NestJS backend for health, entities, import jobs, and webhooks | 3001 | `postgres`, `redis` |
| `web` | React Router embedded Shopify app | 3000 | `postgres`, `api` |
| `nginx` | Public reverse proxy for web, API, and webhooks | 80 | `web`, `api` |

### Connection Graph

`web` uses `DATABASE_URL` for Shopify session storage and `API_INTERNAL_URL=http://api:3001` for server-side route loaders and actions.

`api` uses `DATABASE_URL` for TypeORM and `REDIS_URL` for BullMQ.

`nginx` is the only public entrypoint. It forwards `/api/*` and `/webhooks/*` to `api:3001`, `/health` to the API health endpoint, and all other traffic to `web:3000`.

## Database Creation

Database creation is handled by the official Postgres image, not by ad hoc shell scripts.

### Compose Inputs

```env
POSTGRES_DB=shopify_import
POSTGRES_USER=user
POSTGRES_PASSWORD=password
```

On first startup, Postgres creates the `shopify_import` database automatically.

### Schema Ownership

The web app creates or uses the Shopify session table through `@shopify/shopify-app-session-storage-postgresql` when auth/session storage is initialized.

The API owns the application schema for:

- `shops`
- `db_import`
- `db_import_history`

For this initial Docker implementation, TypeORM schema sync is enabled through `TYPEORM_SYNCHRONIZE=true` so the local stack can bootstrap itself. Before any production deployment, this should be replaced with explicit migrations.

## Files Added Or Updated

### New Files

- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/Dockerfile`
- `apps/api/src/**`
- `docker-compose.yml`
- `nginx/nginx.conf`
- `.dockerignore`

### Updated Files

- `apps/web/Dockerfile`
- `.env.example`
- `.github/copilot-instructions.md`
- `turbo.json`

## Docker Build Strategy

Both app images use multi-stage Node 20 Alpine builds.

### Builder Stage

- Enable `corepack` and `pnpm`
- Copy monorepo manifests first for better layer caching
- Install dependencies once at the workspace root
- Copy app and package sources
- Run filtered Turbo builds
- Use `pnpm deploy --prod` to create a portable runtime payload

### Runner Stage

- Use a fresh `node:20-alpine` image
- Run as non-root user
- Copy only the deployed runtime payload
- Expose the app port
- Add health checks

The `pnpm deploy` step is important because the original web Dockerfile copied only `apps/web/node_modules`, which is fragile in a pnpm workspace.

## Startup Sequence

1. `postgres` starts and creates the database.
2. `redis` starts and becomes available for BullMQ.
3. `api` waits for healthy `postgres` and `redis`, then opens DB and Redis connections.
4. `web` waits for healthy `postgres` and `api`, then starts the SSR app and uses Postgres for Shopify session storage.
5. `nginx` waits for healthy `web` and `api` before exposing the public entrypoint.

## Environment Variables

### Shared

```env
DATABASE_URL=postgresql://user:password@postgres:5432/shopify_import
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
NODE_ENV=production
```

### API Only

```env
REDIS_URL=redis://redis:6379
API_PORT=3001
TYPEORM_SYNCHRONIZE=true
```

### Web Only

```env
API_INTERNAL_URL=http://api:3001
WEB_PORT=3000
```

## Verification Commands

### Install dependencies

```bash
pnpm install
```

### Build the workspace

```bash
pnpm turbo run build
```

### Start the stack

```bash
docker compose up --build
```

### Check container health

```bash
docker compose ps
```

### Confirm database creation

```bash
docker compose exec postgres psql -U user -d shopify_import -c '\\dt'
```

### Confirm API health through nginx

```bash
curl http://localhost/health
```

### Confirm API direct access

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/entities/stats
```

## Current Scope Notes

The API scaffold created in this phase is intentionally minimal. It provides:

- DB and Redis connectivity
- `GET /health`
- `GET /api/entities`
- `GET /api/entities/stats`
- `POST /api/import/bulk`
- `GET /api/import/bulk/status/:jobId`
- `POST /webhooks/:topic`

It does not yet implement the full webhook ingestion, deduplication, upsert, or bulk-import business logic from Phases 3 and 4. Those remain the next backend implementation steps.

## Next Backend Steps

1. Replace the placeholder webhook controller with HMAC validation middleware and queue-backed processing.
2. Implement real bulk import services against Shopify GraphQL.
3. Persist import records and history rows through TypeORM repositories.
4. Replace `TYPEORM_SYNCHRONIZE=true` with real migrations before production deployment.
