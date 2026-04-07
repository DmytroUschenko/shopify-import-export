# Export Pipeline Skill

Project-specific skill for the entity export subsystem.

## What It Covers

- `ProcessorListService` registry pattern
- `ExportStatus` state machine (`Pending → Processing → Exported | Failed`)
- `ConfigurationService` credential loading and `apiSecret` security rules
- `EntityExportRepository.upsert()` usage and UNIQUE constraint
- **6-step checklist** for adding a new entity type to the export pipeline

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Rules quick-reference table + 6-step checklist |
| `AGENTS.md` | Full prose guide with code examples from this codebase |

## Trigger Areas

- `apps/api/src/modules/export/**`
- `apps/api/src/modules/configuration/**`
- `apps/api/src/entities/entity-export.entity.ts`
- `apps/api/src/entities/entity-export-config.entity.ts`
