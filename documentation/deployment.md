# Deployment Guide

## Architecture Overview

The application is split across five Docker containers orchestrated by Docker Compose.

```
                     ┌─────────────────────────────────┐
                     │         nginx : 8080             │
                     │  (reverse proxy / entry point)   │
                     └───────────┬──────────┬───────────┘
                                 │          │
                    /api/*  ─────┘          └─────  /*
                    /webhooks/*                      │
                         │                           │
              ┌──────────▼──────────┐   ┌───────────▼───────────┐
              │   api : 3001        │   │   web : 3000           │
              │   NestJS            │   │   React Router v7      │
              │   BullMQ workers    │   │   Shopify App Bridge   │
              └────┬──────────┬─────┘   └───────────────────────┘
                   │          │
      ┌────────────▼──┐   ┌───▼────────────┐
      │ postgres:5432  │   │  redis:6379    │
      │ PostgreSQL 16  │   │  Redis 7       │
      └────────────────┘   └────────────────┘
```

| Service | Image | Internal port | Host port |
|---|---|---|---|
| `postgres` | `postgres:16` | 5432 | 5432 |
| `redis` | `redis:7-alpine` | 6379 | 6379 |
| `api` | built from `apps/api/Dockerfile` | 3001 | 3001 |
| `web` | built from `apps/web/Dockerfile` | 3000 | 3000 |
| `nginx` | `nginx:alpine` | 80 | **8080** |

> **Why 8080?** Port 80 is commonly occupied on developer machines. Change the nginx `ports` mapping in `docker-compose.yml` to `'80:80'` on a dedicated server where port 80 is free.

---

## Container Build Strategy

Both application images use **multi-stage Docker builds**.

### Stage 1 — builder (`node:20-alpine`)

1. Enable pnpm via corepack.
2. Copy workspace manifests only (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`) — this layer is cached as long as dependencies don't change.
3. `pnpm install --frozen-lockfile` — installs the full workspace.
4. Copy source code.
5. `pnpm turbo run build --filter=@shopify-import/<app>` — compiles the app and all workspace dependencies in the correct order.
6. `pnpm --filter=@shopify-import/<app> deploy --prod /out` — extracts a minimal production `node_modules` into `/out`.

### Stage 2 — runner (`node:20-alpine`)

1. Creates a non-root system user (`appuser`, uid 1001).
2. Copies only `/out` from the builder — no dev tools, no source, no build cache.
3. Runs as `appuser` for least-privilege security.

---

## Prerequisites

- Docker ≥ 24 and Docker Compose v2 (`docker compose` subcommand)
- GNU Make (pre-installed on macOS and most Linux distros)
- A valid Shopify Partner app with `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`
- A public tunnel URL (ngrok or equivalent) for `SHOPIFY_APP_URL`

---

## Makefile Quick Reference

All common operations are wrapped in `make` targets. Run `make help` to print the full list.

| Target | Description |
|---|---|
| `make deploy` | **First-time deploy** — copy `.env`, build, start, health-check |
| `make redeploy` | `git pull` → rebuild + restart all services |
| `make redeploy-api` | `git pull` → rebuild + restart `api` only |
| `make redeploy-web` | `git pull` → rebuild + restart `web` only |
| `make start` | Start all services (no rebuild) |
| `make stop` | Stop all services |
| `make restart` | Restart all services |
| `make ps` | Service status overview |
| `make health` | Hit `/health` and print JSON response |
| `make logs` | Tail all logs |
| `make logs-api` | Tail api logs |
| `make logs-web` | Tail web logs |
| `make db-shell` | Open a psql shell |
| `make db-tables` | List all tables |
| `make down` | Remove containers (keep volume) |
| `make down-volumes` | Remove containers **and** volume — destroys all data |

---

## Environment Setup

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

Key variables to configure in `.env`:

```dotenv
# Postgres bootstrap — used by the postgres container itself
POSTGRES_DB=shopify_import
POSTGRES_USER=user
POSTGRES_PASSWORD=password

# Connection strings — use Docker service hostnames inside the stack
DATABASE_URL=postgresql://user:password@postgres:5432/shopify_import
REDIS_URL=redis://redis:6379

# Shopify Partner app credentials
SHOPIFY_API_KEY=<your_api_key>
SHOPIFY_API_SECRET=<your_api_secret>
SHOPIFY_APP_URL=https://<your-ngrok-or-domain>

# Internal Docker network routing (do not change for Docker deployments)
API_INTERNAL_URL=http://api:3001

# API behaviour
TYPEORM_SYNCHRONIZE=true   # set to false and use migrations in production
API_PORT=3001
WEB_PORT=3000
NODE_ENV=production
```

> **Security note:** Never commit `.env` to version control. `.gitignore` already excludes it. Only commit `.env.example`.

---

## First Deploy

```bash
make deploy
```

This single command will:

1. Detect if `.env` is missing — if so, copy `.env.example` to `.env`, print a reminder to fill in the values, and exit. Edit `.env`, then run `make deploy` again.
2. Build all Docker images.
3. Start every service in the background (`-d`).
4. Print the container status table.
5. Run a health check against `http://localhost:8080/health`.

Expected output after a successful deploy:

```
NAME                        STATUS
shopify-import-postgres-1   Up N minutes (healthy)
shopify-import-redis-1      Up N minutes (healthy)
shopify-import-api-1        Up N minutes (healthy)
shopify-import-web-1        Up N minutes (healthy)
shopify-import-nginx-1      Up N minutes
```

---

## Verification

```bash
make health   # hits http://localhost:8080/health and pretty-prints the JSON response
```

Manual curl checks:

```bash
# Health check through the nginx proxy
curl http://localhost:8080/health
# → {"status":"ok","checks":{"database":"up","redis":"up"}}

# API directly
curl http://localhost:3001/health

# Entity stats
curl http://localhost:3001/api/entities/stats

# Web app (redirects to Shopify auth — HTTP 410 without a valid shop session is expected)
curl -I http://localhost:3000/
```

---

## Service Startup Order

Docker Compose enforces this dependency chain via `depends_on` + `condition: service_healthy`:

```
postgres ──► api ──► web ──► nginx
redis    ──►
```

No service starts until all of its dependencies pass their healthcheck.

---

## Routine Operations

| Command | Description |
|---|---|
| `make start` | Start all services (no rebuild) |
| `make stop` | Stop all services (keep containers and volumes) |
| `make restart` | Restart all services |
| `make ps` | Show status of all services |
| `make health` | Hit `/health` through nginx and print the JSON response |
| `make logs` | Tail logs for all services (Ctrl-C to exit) |
| `make logs-api` | Tail api logs only |
| `make logs-web` | Tail web logs only |
| `make down` | Stop and remove containers (keeps the `postgres-data` volume) |
| `make down-volumes` | Stop and remove containers **and** all volumes — destroys all data (asks for confirmation) |

---

## Rebuilding After Code Changes

All redeploy targets run `git pull` first, then rebuild only what is needed.

| Command | What it does |
|---|---|
| `make redeploy` | `git pull` → rebuild and restart **all** services |
| `make redeploy-api` | `git pull` → rebuild and restart the **api** service only |
| `make redeploy-web` | `git pull` → rebuild and restart the **web** service only |

Rebuild without pulling (e.g. local changes):

```bash
docker compose build --no-cache api   # api only
docker compose build --no-cache web   # web only
docker compose up --build -d          # everything
```

---

## Database

Data is stored in the named Docker volume `postgres-data`. With `TYPEORM_SYNCHRONIZE=true`, TypeORM automatically creates and alters tables on startup.

> **Production recommendation:** set `TYPEORM_SYNCHRONIZE=false` and manage schema changes with TypeORM migrations.

Connect directly to the running database:

```bash
make db-shell    # opens a psql shell inside the postgres container
```

List tables:

```bash
make db-tables
```

---

## Nginx Routing

Defined in `nginx/nginx.conf`:

| Path prefix | Proxied to |
|---|---|
| `/health` | `api:3001/health` |
| `/api/*` | `api:3001` |
| `/webhooks/*` | `api:3001` |
| everything else | `web:3000` |

---

## Production Checklist

- [ ] `NODE_ENV=production` (already the default in `docker-compose.yml`)
- [ ] `TYPEORM_SYNCHRONIZE=false` with explicit migrations
- [ ] Strong `POSTGRES_PASSWORD` — not `password`
- [ ] `SHOPIFY_APP_URL` points to the real public domain, not an ngrok tunnel
- [ ] Change nginx port from `8080:80` to `80:80` (add `443:443` for TLS)
- [ ] Set up TLS termination (e.g. Certbot / Let's Encrypt) in front of nginx
- [ ] Remove host `ports:` entries for `postgres` (5432) and `redis` (6379) — they must not be reachable from the public internet
- [ ] `restart: unless-stopped` is already set on all services
