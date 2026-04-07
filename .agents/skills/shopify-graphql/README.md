# Shopify GraphQL Skill

Patterns for querying the Shopify Admin GraphQL API from the NestJS backend.

## What It Covers

- Access-token header authentication
- Cursor-based pagination (250/page max, `pageInfo.hasNextPage` + `endCursor`)
- GraphQL error handling (`errors[]` array, not HTTP status)
- Rate limiting with exponential backoff (HTTP 429 / `THROTTLED`)
- Bulk Operations API for large datasets (>10k records)
- Field selection best practices

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Rules quick-reference table + pagination template |
| `AGENTS.md` | Full prose guide with TypeScript code examples |

## Trigger Areas

- `apps/api/src/modules/export/processors/` — any processor calling Shopify API
- `apps/api/src/modules/import/` — `BulkImportService` and related
- Any `fetch()` or GraphQL client call to `*.myshopify.com`
