# Brainstorm — Expanded Guide

## Purpose

This skill produces a **decision document**, not code. Its goal is to surface trade-offs and align on an approach before any implementation begins.

**Do not write code during a brainstorm session.**
**Await user approval of the Decision section (§4) before switching to an implementation skill.**

---

## When to Trigger

Automatically apply this skill when the user says:

- "let's add [feature]"
- "should we [approach]"
- "design a [system]"
- "how should we approach [problem]"
- Any request that touches more than one module or package

If a feature is a single-file change with an obvious implementation, you may skip brainstorm and proceed directly. Use judgement.

---

## How to Run a Session

1. **Read the relevant code first.** Understand what already exists before proposing options.
2. **Fill in all 7 sections.** Even a one-line answer in each section is better than skipping it.
3. **Present the document to the user.** Highlight §4 (Decision) explicitly and ask for approval.
4. **On approval**, switch to the appropriate implementation skill (e.g. `export-pipeline`, `bullmq`).
5. **On rejection**, revise §3 (options) and §4 (decision) based on user feedback.

---

## Worked Example — "Add webhook-triggered export"

### 1. Problem Statement
Orders received via webhook are stored in `db_import` but not forwarded to the external CRM. Without this feature, the CRM stays out of sync until a manual export is triggered.

### 2. Constraints
| Type | Constraint |
|------|-----------|
| Hard | Webhook handler must return HTTP 200 within 5 s (Shopify SLA) |
| Hard | `entity_export` has UNIQUE (shop_id, entity_id, entity_type) — must upsert |
| Hard | `apiSecret` must never appear in API responses |
| Soft | Prefer reusing the existing `ProcessorListService` over a parallel registry |

### 3. Option Space
| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| Do nothing | Zero cost | CRM stays out of sync | — |
| Inline in webhook handler | Simple, no queue | Breaks 5 s SLA for slow CRMs | S |
| BullMQ export queue | Decoupled, retriable, < 5 s webhook path | Extra queue to manage | M |
| Polling job (cron) | No webhook coupling | Latency up to poll interval | M |

### 4. Decision and Rationale
**Chosen: BullMQ export queue.**
Inline processing is ruled out — it risks breaching the 5 s Shopify SLA. A polling cron adds unnecessary latency for real-time CRM sync. The BullMQ approach reuses existing `ProcessorListService` infrastructure and keeps the webhook path fast.

### 5. Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Redis outage drops export jobs | Low | High | Set `removeOnFail: 50`; add alerting on failed job count |
| CRM API down causes retry storm | Medium | Medium | Exponential backoff with cap; dead-letter queue |
| `apiSecret` leaked in logs | Low | High | Never log `config.apiSecret`; use `[REDACTED]` in log lines |

### 6. Implementation Checklist
1. Add `export-entity` queue name to `BullModule.registerQueue()` in `ExportModule` — `export.module.ts`
2. Create `ExportEntityProcessor extends WorkerHost` — `modules/export/processors/export-entity.processor.ts`
3. Enqueue in webhook handler after upsert — `modules/webhook/webhook.service.ts`
4. Add `@InjectQueue('export-entity')` to `WebhookService` — `modules/webhook/webhook.service.ts`
5. Update `ExportModule` to export the queue token so `WebhookModule` can inject it

### 7. Open Questions
- [ ] Should failed export jobs alert via Slack or just appear in BullMQ dashboard?
- [ ] Is there a maximum retry budget before marking an export permanently failed?
- [ ] Does the CRM API require idempotency keys?

---

## Tips

- Keep §3 options honest — include "do nothing" and at least one simpler option.
- §6 should name specific files, not just modules.
- §7 open questions block coding — resolve them before starting implementation.
