# Export Feature + Configurations Solution

## Overview

This document describes the export feature and configurations UI added to the Shopify Import app.

---

## Database Tables

### `entity_export`
Tracks per-shop export records for any entity type.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid FK shops | CASCADE delete |
| entity_type | varchar | flexible string, not enum-constrained |
| entity_id | varchar | external Shopify entity ID |
| status | enum ExportStatus | default: `pending` |
| data | jsonb | export payload / metadata |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| UNIQUE | (shop_id, entity_id, entity_type) | |

### `shop_config`
Magento-style generic key-value configuration table, shared across all features.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid FK shops | CASCADE delete |
| config_path | varchar | slash-separated key, e.g. `export/order/is_enabled` |
| config_value | text | nullable; all values stored as strings |
| UNIQUE | (shop_id, config_path) | |

Adding a new configuration key requires **no schema change** -- simply register the path definition in the relevant module.

---

## Shared Types (`packages/shared`)

Added `ExportStatus` enum to `enums.ts`:

```typescript
export enum ExportStatus {
  Pending = 'pending',
  Processing = 'processing',
  Exported = 'exported',
  Failed = 'failed',
}
```

---

## Configuration System (`modules/configuration/`)

### `ShopConfigRegistry`
Injectable registry service exported from `ConfigurationModule`. Feature modules inject it and register their own path definitions in `onModuleInit()`.

```typescript
interface ConfigPathDefinition {
  path: string;          // e.g. 'export/order/is_enabled'
  group: string;         // e.g. 'export/order'
  groupLabel: string;    // e.g. 'Order Export API'  -- tab label in UI
  label: string;         // field display name
  type: 'string' | 'boolean' | 'password';
  defaultValue?: string;
  description?: string;
  writeOnly?: boolean;   // never returned in GET responses (e.g. api_secret)
}
```

Methods: `register(defs)`, `getDefinition(path)`, `getDefault(path)`, `getGroupedDefinitions()`, `getAllDefinitions()`.

### `ShopConfigService`
Generic CRUD service over the `shop_config` table.

| Method | Description |
|---|---|
| `get(shopId, path)` | Returns DB value, falls back to registry default |
| `getWithDefault(shopId, path, fallback)` | Returns value or supplied fallback |
| `set(shopId, path, value)` | Upsert single path |
| `setMany(shopId, entries)` | Batch upsert in a single transaction |
| `getByPrefix(shopId, prefix)` | All paths under prefix, defaults merged in |

### `ConfigurationService`
Higher-level adapter used by the controller. Resolves shop domain to UUID internally.

| Method | Description |
|---|---|
| `getGroupedConfig(shopDomain)` | All registered configs grouped, with current values |
| `getOne(shopDomain, path)` | Single path value + metadata |
| `upsertConfigs(shopDomain, updates)` | Batch write via `ShopConfigService.setMany()` |
| `upsertOne(shopDomain, path, value)` | Single path write |

### REST API

| Method | Path | Description |
|---|---|---|
| GET | `/api/configuration/:shopDomain` | All configs, grouped by `group` |
| PUT | `/api/configuration/:shopDomain` | Batch upsert `{ [path]: value }` |
| GET | `/api/configuration/:shopDomain/:configPath(*)` | Single path value + metadata |
| PUT | `/api/configuration/:shopDomain/:configPath(*)` | Single path upsert `{ value }` |

`writeOnly` paths (e.g. `api_secret`) are accepted in PUT but never returned in GET responses.

---

## API Modules

### `modules/export/`

**`EntityExportRepository`** -- domain-specific TypeORM-backed repository:
- `upsert(shopId, entityType, entityId, data, status)` -- INSERT ON CONFLICT DO UPDATE
- `updateStatus(id, status)` -- update single record status
- `findPendingByShop(shopId)` -- returns all pending records for a shop
- `findById(id)`

**`EntityProcessor` interface** (`processors/entity-processor.interface.ts`):
```typescript
interface EntityProcessor {
  process(exportRecord: EntityExportEntity): Promise<void>;
}
```

**`OrderProcessor`** -- implements `EntityProcessor` for `order` entity type.

**`ProcessorListService`** -- registry mapping entity type strings to processors:
- `register(entityType, processor)` -- allows dynamic registration
- `getProcessor(entityType)` -- throws `NotFoundException` if not registered
- `hasProcessor(entityType)` -- check if a processor exists
- `process(exportRecord)` -- dispatches to the correct processor

**`export.config-paths.ts`** -- local typed path constants + definitions registered in `ExportModule.onModuleInit()`:
```typescript
export const EXPORT_CONFIG_PATHS = {
  ORDER_ENABLED:    'export/order/is_enabled',
  ORDER_API_NAME:   'export/order/api_name',
  ORDER_API_KEY:    'export/order/api_key',
  ORDER_API_SECRET: 'export/order/api_secret',
} as const;
```

---

## Web UI (`apps/web`)

### `routes/configurations._index.tsx`

- Protected with `authenticate.admin(request)`
- **Loader**: `GET /api/configuration/:shopDomain` -- loads all groups dynamically
- **Action**: two intents:
  - `save-one` -- `PUT /api/configuration/:shopDomain/:configPath` (per-field Save button)
  - `save-group` -- `PUT /api/configuration/:shopDomain` (batch "Save All" button)
- Polaris `Tabs` -- one tab per registered group, generated from API response
- Each tab renders its items by type: `boolean` -> Checkbox, `string` -> TextField, `password` -> TextField
- No hard-coded entity type lists -- fully dynamic

### Navigation

`NavMenu` from `@shopify/app-bridge-react` added to `root.tsx`:
- Dashboard (`/`)
- Import (`/import`)
- Entities (`/entities`)
- **Configurations (`/configurations`)**

---

## Adding New Config Paths

To add a new configuration key for any module:

1. Create `apps/api/src/modules/{module}/{module}.config-paths.ts`:
   ```typescript
   export const MY_CONFIG_PATHS = { KEY: 'my/key/path' } as const;
   export const MY_CONFIG_DEFINITIONS: ConfigPathDefinition[] = [
     { path: MY_CONFIG_PATHS.KEY, group: 'my/group', groupLabel: 'My Group', label: 'My Field', type: 'string' },
   ];
   ```
2. Import `ConfigurationModule` in your feature module
3. Implement `OnModuleInit` and call `this.shopConfigRegistry.register(MY_CONFIG_DEFINITIONS)` in `onModuleInit()`
4. The web UI will automatically render the new group/fields -- **no UI changes needed**

## Adding New Entity Processors

To add support for a new entity type (e.g. `customer`):

1. Create `apps/api/src/modules/export/processors/customer.processor.ts` implementing `EntityProcessor`
2. Add it as a provider in `ExportModule`
3. Register it in `ProcessorListService.onModuleInit()`:
   ```typescript
   this.register('customer', this.customerProcessor);
   ```
