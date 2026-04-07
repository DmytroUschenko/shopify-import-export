# GitHub Copilot Instructions — Shopify Import App

## Monorepo Structure

This is a **Turborepo + pnpm** monorepo. Understand which app owns what before suggesting changes.

| Path | Owns |
|---|---|
| `apps/web/` | React Router v7 embedded Shopify admin app (Polaris + App Bridge) |
| `apps/api/` | NestJS API — webhooks, BullMQ queues, bulk import, DB access |
| `packages/shared/` | Plain TypeScript types only — enums + payload interfaces, **no TypeORM decorators** |
| `packages/config/` | Shared `tsconfig.base.json` and ESLint base config |

**Never** put TypeORM `@Entity` classes in `packages/shared`. Those belong exclusively in `apps/api/src/entities/`.

---

## TypeScript Types vs TypeORM Entities

- `packages/shared/src/enums.ts` — `EntityType`, `ImportStatus`, `ExportStatus` enums (used by both apps)
- `packages/shared/src/payloads.ts` — `OrderPayload`, `CustomerPayload`, `ProductPayload` interfaces (type the `data: JSONB` column)
- `apps/api/src/entities/` — TypeORM classes: `ShopEntity`, `DbImportEntity`, `DbHistoryEntity`, `EntityExportEntity`, `EntityExportConfigEntity`
- There are **no** `OrderEntity`, `CustomerEntity`, or `ProductEntity` TypeORM classes — all Shopify data lives in `DbImportEntity.data` (JSONB)

---

## Naming Conventions

### NestJS modules (in `apps/api/src/modules/`)
- `shopify/` — webhook registration, access token management
- `webhook/` — `POST /webhooks/:topic` handler + HMAC validation middleware
- `import/` — BullMQ queues, processors, `BulkImportService`
- `entities/` — `GET /api/entities` query endpoint
- `health/` — `GET /health`
- `configuration/` — `GET|PUT /api/configuration/:shopDomain/:entityType` — export API credentials per entity type; `apiSecret` write-only
- `export/` — `ProcessorListService` registry, per-entity processors, `EntityExportRepository`; `ExportStatus` state machine

### Entity types (values of `EntityType` enum)
`order`, `customer`, `product`, `fulfillment`

### Import status values (`ImportStatus` enum)
`received`, `processing`, `processed`, `failed`, `bulk_imported`

### Export status values (`ExportStatus` enum)
`pending`, `processing`, `exported`, `failed`

Valid transitions: `pending → processing → exported | failed`. Never skip `processing`; never revert to `pending`.

### BullMQ queue names
- `process-entity` — individual webhook event processing
- `bulk-import` — cursor-paginated Shopify entity import
- `export-entity` — per-entity export to external system (planned)

---

## Webhook Flow (summarised)

```
Shopify → POST /webhooks/:topic
  ↓ Validate X-Shopify-Hmac-Sha256 (401 if invalid)
  ↓ Deduplicate on X-Shopify-Event-Id via Redis (skip if seen)
  ↓ Upsert db_import (status=received) + INSERT db_history
  ↓ Enqueue job → BullMQ `process-entity` queue
  ↓ Return HTTP 200 immediately (< 5 s SLA)
  ↓ Worker: db_import.status → processing → processed
```

HMAC validation lives in `webhook.middleware.ts`, **not** in the controller.

---

## Bulk Import Flow

```
Admin UI → POST /api/import/bulk { entityType }
  ↓ BulkImportService: cursor-paginated GraphQL (250/page)
  ↓ Per batch: upsert db_import + INSERT db_history (status=bulk_imported)
  ↓ Progress tracked in BullMQ job
  ↓ GET /api/import/bulk/status/:jobId → Polaris ProgressBar
```

---

## Environment Variables

All env vars are typed via NestJS `ConfigModule`. Reference `.env.example` for the full list.

| Variable | Used by |
|---|---|
| `DATABASE_URL` | `apps/web` via Shopify PostgreSQL session storage and `apps/api` via TypeORM |
| `REDIS_URL` | `apps/api` via BullMQ / ioredis |
| `SHOPIFY_API_KEY` | `apps/web` + `apps/api` |
| `SHOPIFY_API_SECRET` | `apps/api` (HMAC validation) |
| `SHOPIFY_APP_URL` | `apps/web` (App Bridge host) |

Never hardcode secrets. Always read from `ConfigService`.

---

## Key Constraints

- Shopify webhooks **must** receive HTTP 200 within 5 seconds — do all heavy work in BullMQ workers, not in the controller.
- `db_import` has a `UNIQUE (shop_id, entity_id, entity_type)` constraint — always use upsert (`INSERT ... ON CONFLICT DO UPDATE`), never plain insert.
- `entity_export` has a `UNIQUE (shop_id, entity_id, entity_type)` constraint — always use `EntityExportRepository.upsert()`, never plain insert.
- `db_import_history` is an **immutable audit log** — never update or delete rows from it.
- Inter-service communication uses the internal Docker network (`api:3001`), not `localhost`.
- The `packages/shared` package must remain free of any Node.js-only or NestJS-only dependencies so it can be imported by the frontend.
- `apiSecret` in `entity_export_config` is **write-only** — never return it in API responses; omit it explicitly in all DTOs and serializers.
- `ProcessorListService` is a **singleton** — its processor `Map` is shared across all requests; never store per-request state in it.

---

## Export Pipeline Flow

```
PUT /api/configuration/:shopDomain/:entityType  ← store API credentials (apiSecret write-only)
  ↓
(trigger: webhook, scheduled job, or manual action)
  ↓
EntityExportRepository.upsert({ status: Pending })
  ↓
ProcessorListService.process(exportRecord)
  ↓ getProcessor(entityType) → throws NotFoundException if not registered
  ↓ ConfigurationService.getConfig(shopDomain, entityType)
EntityProcessor.process(exportRecord)           ← calls external API with credentials
  ↓
EntityExportRepository.updateStatus(id, Exported | Failed)
```

State machine: `Pending → Processing → Exported | Failed`
- Never skip `Processing`.
- Never revert to `Pending`.
- Throw to signal failure (BullMQ will retry).

---

## Required Skills — Read Before Coding

Before writing or modifying code in any area below, **always** call `read_file` on the corresponding skill file first:

| Area | Skill file to read |
|---|---|
| `apps/web/**` — any plan or action in the `apps/web/` directory; Shopify app installation; Shopify CLI operations (app creation, app connection, `shopify app dev`, etc.); any changes to `shopify.app.toml` | `.agents/skills/shopify-apps/SKILL.md` |
| `apps/web/**` — React components, performance | `.agents/skills/vercel-react-best-practices/SKILL.md` |
| `apps/api/**` — any NestJS module, service, guard, pipe | `.agents/skills/nestjs-best-practices/SKILL.md` |
| `apps/api/src/entities/**` — TypeORM entities, migrations, queries | `.agents/skills/typeorm/SKILL.md` |
| `**/Dockerfile` — any Dockerfile | `.agents/skills/multi-stage-dockerfile/SKILL.md` |
| `modules/export/**`, `modules/configuration/**`, `entities/entity-export*.ts` — export pipeline, processor registry, ExportStatus state machine | `.agents/skills/export-pipeline/SKILL.md` |
| Any file with `@Processor`, `InjectQueue`, `WorkerHost`, `BullModule` — BullMQ queues and workers | `.agents/skills/bullmq/SKILL.md` |
| Any Shopify Admin GraphQL API call from `apps/api/src/` — pagination, rate limits, error handling | `.agents/skills/shopify-graphql/SKILL.md` |
| Feature design spanning >1 module — "let's add", "design a", "should we", "how should we approach" | `.agents/skills/brainstorm/SKILL.md` |

Do **not** skip this step. Reading the skill is mandatory before implementing, reviewing, or refactoring code in the listed areas.
