---
name: export-pipeline
description: Project-specific skill for the entity export pipeline — processor registry pattern, ExportStatus state machine, configuration security rules, and the 6-step checklist for adding a new entity type. Use when editing modules/export/, modules/configuration/, or entities/entity-export*.ts.
license: MIT
metadata:
  author: project
  version: "1.0.0"
---

# Export Pipeline

Architecture guide for the entity export subsystem. Covers the `ProcessorListService` registry, `ExportStatus` state machine, `ConfigurationService` credential handling, and the canonical checklist for extending the pipeline with a new entity type.

## When to Apply

Reference these guidelines when:

- Editing any file in `apps/api/src/modules/export/`
- Editing any file in `apps/api/src/modules/configuration/`
- Editing `apps/api/src/entities/entity-export.entity.ts` or `entity-export-config.entity.ts`
- Adding a new `EntityType` value to `packages/shared/src/enums.ts`
- Designing or reviewing an export flow for a new Shopify entity

## Key Rules

| Rule | Priority | Summary |
|------|----------|---------|
| `state-machine-forward-only` | CRITICAL | `Pending → Processing → Exported \| Failed` — no skipping, no reverting to Pending |
| `processor-interface` | CRITICAL | Every processor implements `EntityProcessor` with a single `process(record): Promise<void>` |
| `read-config-before-api` | CRITICAL | Always load `EntityExportConfigEntity` via `ConfigurationService` before calling any external API |
| `api-secret-write-only` | HIGH | `apiSecret` is stored but never returned in API responses — omit it in all DTOs/serializers |
| `upsert-not-insert` | HIGH | Use `EntityExportRepository.upsert()` — never plain INSERT; `(shopId, entityId, entityType)` has a UNIQUE constraint |
| `register-in-onModuleInit` | HIGH | Call `this.register(EntityType.X, this.xProcessor)` inside `onModuleInit()`, not in the constructor |
| `processor-singleton` | MEDIUM | `ProcessorListService` is a singleton — its `processors` Map is shared; never store per-request state in it |

## 6-Step Extension Checklist

To add export support for a new entity type (e.g. `Customer`):

1. **Enum** — add `Customer = 'customer'` to `EntityType` in `packages/shared/src/enums.ts`
2. **Processor** — create `apps/api/src/modules/export/processors/customer.processor.ts` implementing `EntityProcessor`
3. **Module provider** — add `CustomerProcessor` to `providers` in `ExportModule`
4. **Service injection** — inject `CustomerProcessor` into `ProcessorListService` constructor
5. **Registration** — call `this.register(EntityType.Customer, this.customerProcessor)` in `onModuleInit()`
6. **Migration** — add a TypeORM migration if the new type requires new columns on `entity_export_config`

See `AGENTS.md` for full code examples of each step.
