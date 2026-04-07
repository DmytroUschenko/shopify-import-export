# Export Pipeline — Expanded Guide

## Overview

The export pipeline pushes Shopify entity data to external third-party systems on demand. It is distinct from the import pipeline, which pulls data from Shopify into the local database.

```
PUT /api/configuration/:shopDomain/:entityType   ← store API credentials
  ↓
(trigger: webhook, scheduled job, or manual action)
  ↓
ProcessorListService.process(exportRecord)
  ↓ looks up processor by entityType
  ↓ reads credentials from ConfigurationService
EntityProcessor.process(exportRecord)            ← sends data to external API
  ↓
EntityExportRepository.updateStatus(id, Exported | Failed)
```

---

## ExportStatus State Machine

```
Pending ──► Processing ──► Exported
                 │
                 └──────► Failed
```

**Rules:**
- A record enters `Pending` on creation (default column value).
- Set to `Processing` immediately before calling the external API.
- Set to `Exported` on success, `Failed` on any thrown error.
- Never transition backwards to `Pending`.
- Never skip `Processing` — it acts as a distributed lock signal.

---

## ProcessorListService — Registry Pattern

`ProcessorListService` is a singleton that holds a `Map<string, EntityProcessor>`. Processors register themselves in `onModuleInit()`.

```typescript
// modules/export/processor-list.service.ts
@Injectable()
export class ProcessorListService implements OnModuleInit {
  private readonly processors = new Map<string, EntityProcessor>();

  constructor(private readonly orderProcessor: OrderProcessor) {}

  onModuleInit(): void {
    this.register('order', this.orderProcessor);
  }

  register(entityType: string, processor: EntityProcessor): void {
    this.processors.set(entityType, processor);
  }

  async process(exportRecord: EntityExportEntity): Promise<void> {
    const processor = this.getProcessor(exportRecord.entityType);
    await processor.process(exportRecord);
  }
}
```

**Never** store per-request state in `ProcessorListService`. Its `processors` Map is shared across all concurrent requests.

---

## EntityProcessor Interface

```typescript
// modules/export/processors/entity-processor.interface.ts
export interface EntityProcessor {
  process(exportRecord: EntityExportEntity): Promise<void>;
}
```

Each entity type gets its own class implementing this interface.

---

## ConfigurationService — Credentials

Before calling any external API, load credentials from `ConfigurationService`:

```typescript
// Inside a processor
constructor(private readonly configurationService: ConfigurationService) {}

async process(exportRecord: EntityExportEntity): Promise<void> {
  const config = await this.configurationService.getConfig(
    exportRecord.shop.domain,
    exportRecord.entityType,
  );

  if (!config?.isEnabled) {
    this.logger.warn(`Export disabled for ${exportRecord.entityType}`);
    return;
  }

  // Use config.apiKey / config.apiSecret to authenticate
  // ...
}
```

**`apiSecret` is write-only.** It is stored in the database but must never appear in API response bodies. The `ConfigurationController` explicitly omits it:

```typescript
const { apiSecret: _omit, ...safe } = config;
return safe;
```

---

## EntityExportRepository — Upsert

`entity_export` has a `UNIQUE (shop_id, entity_id, entity_type)` constraint. Always use `upsert()`:

```typescript
await this.entityExportRepository.upsert({
  shopId,
  entityId,
  entityType,
  status: ExportStatus.Pending,
  data: payload,
});
```

Never use a plain `INSERT` — it will throw on duplicate records.

---

## 6-Step Extension Checklist (Worked Example: Customer)

### Step 1 — Add enum value
```typescript
// packages/shared/src/enums.ts
export enum EntityType {
  Order = 'order',
  Customer = 'customer',  // ← add this
  // ...
}
```

### Step 2 — Create processor
```typescript
// apps/api/src/modules/export/processors/customer.processor.ts
import { Injectable, Logger } from '@nestjs/common';
import { EntityExportEntity } from '../../../entities/entity-export.entity';
import { EntityProcessor } from './entity-processor.interface';

@Injectable()
export class CustomerProcessor implements EntityProcessor {
  private readonly logger = new Logger(CustomerProcessor.name);

  async process(exportRecord: EntityExportEntity): Promise<void> {
    this.logger.log(`Processing customer export: entityId=${exportRecord.entityId}`);
    // TODO: call external API
  }
}
```

### Step 3 — Register as provider in ExportModule
```typescript
// apps/api/src/modules/export/export.module.ts
@Module({
  providers: [EntityExportRepository, ProcessorListService, OrderProcessor, CustomerProcessor],
  exports: [EntityExportRepository, ProcessorListService],
})
export class ExportModule {}
```

### Step 4 — Inject into ProcessorListService
```typescript
constructor(
  private readonly orderProcessor: OrderProcessor,
  private readonly customerProcessor: CustomerProcessor,  // ← add
) {}
```

### Step 5 — Register in onModuleInit
```typescript
onModuleInit(): void {
  this.register('order', this.orderProcessor);
  this.register('customer', this.customerProcessor);  // ← add
}
```

### Step 6 — Migration (if needed)
If the new entity type requires extra config columns (e.g. a `webhookUrl` specific to customers), generate a TypeORM migration:

```bash
pnpm --filter=@shopify-import/api typeorm migration:generate src/migrations/AddCustomerExportConfig
```

---

## Testing

```typescript
describe('ProcessorListService', () => {
  it('throws NotFoundException for unregistered entity type', () => {
    const service = new ProcessorListService(mockOrderProcessor);
    service.onModuleInit();
    expect(() => service.getProcessor('unknown')).toThrow(NotFoundException);
  });
});
```

Always test that `getProcessor` throws for unknown types and that the state machine transitions correctly.
