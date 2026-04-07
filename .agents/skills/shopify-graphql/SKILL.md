---
name: shopify-graphql
description: Shopify Admin GraphQL API patterns — cursor-based pagination, rate limiting, bulk operations, access-token header, and GraphQL error handling. Use when making any Shopify API call from apps/api/src/.
license: MIT
metadata:
  author: project
  version: "1.0.0"
---

# Shopify GraphQL

Patterns for querying the Shopify Admin GraphQL API from the NestJS backend. Canonical reference: the cursor-paginated GraphQL fetch pattern in `BulkImportService`.

## When to Apply

Reference these guidelines when:

- Writing or modifying any Shopify Admin API call in `apps/api/src/`
- Implementing an `OrderProcessor` or any entity processor that calls Shopify GraphQL
- Using bulk operation queries (`bulkOperationRunQuery`)
- Handling Shopify API rate limiting or errors
- Fetching paginated entity lists (orders, customers, products, etc.)

## Key Rules

| Rule | Priority | Summary |
|------|----------|---------|
| `cursor-pagination-only` | CRITICAL | Use `after: $cursor` + `pageInfo.hasNextPage` — never use offset (`first: N, skip: M`) |
| `check-errors-array` | CRITICAL | Check `response.errors[]` on every GraphQL response — HTTP 200 does not mean success |
| `access-token-header` | CRITICAL | Send `X-Shopify-Access-Token: <token>` header on every request; read token from `ConfigService` |
| `page-size-max-250` | HIGH | Use `first: 250` per page — Shopify's maximum; smaller values just waste round-trips |
| `exponential-backoff-429` | HIGH | On HTTP 429 or `THROTTLED` error, wait and retry with exponential backoff |
| `request-only-used-fields` | MEDIUM | Only include fields in the GraphQL query that are actually used — minimises response size and cost |
| `bulk-ops-for-large-datasets` | MEDIUM | For >10k records, prefer `bulkOperationRunQuery` + polling over cursor pagination |

## Pagination Template

```typescript
let cursor: string | null = null;
let hasNextPage = true;

while (hasNextPage) {
  const response = await this.shopifyClient.query({
    data: {
      query: ORDERS_QUERY,
      variables: { first: 250, after: cursor },
    },
  });

  if (response.body.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(response.body.errors)}`);
  }

  const { nodes, pageInfo } = response.body.data.orders;
  // process nodes ...

  hasNextPage = pageInfo.hasNextPage;
  cursor = pageInfo.endCursor;
}
```

See `AGENTS.md` for bulk operation polling, backoff implementation, and error type handling.
