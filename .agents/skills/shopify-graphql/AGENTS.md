# Shopify GraphQL — Expanded Guide

## Authentication

Every request to the Shopify Admin GraphQL API requires an access token header:

```typescript
const response = await fetch(
  `https://${shopDomain}/admin/api/2026-04/graphql.json`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,  // ← always required
    },
    body: JSON.stringify({ query, variables }),
  },
);
```

Read `accessToken` from `ConfigService` or from `EntityExportConfigEntity.apiKey` (for third-party destinations). Never hardcode.

---

## Cursor-Based Pagination

Shopify uses Relay-style cursor pagination. Maximum page size is `first: 250`.

```graphql
query GetOrders($first: Int!, $after: String) {
  orders(first: $first, after: $after) {
    nodes {
      id
      name
      createdAt
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

TypeScript implementation:

```typescript
async fetchAllOrders(shopDomain: string, accessToken: string): Promise<Order[]> {
  const all: Order[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const body = await this.graphqlRequest(shopDomain, accessToken, {
      query: GET_ORDERS_QUERY,
      variables: { first: 250, after: cursor },
    });

    if (body.errors?.length) {
      throw new Error(`Shopify errors: ${JSON.stringify(body.errors)}`);
    }

    const { nodes, pageInfo } = body.data.orders;
    all.push(...nodes);

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor ?? null;
  }

  return all;
}
```

**Never use offset pagination** (`skip`, `offset`, or page numbers). Shopify does not support it for most resources and it produces inconsistent results on large datasets.

---

## Error Handling

GraphQL returns HTTP 200 even when there are errors. Always check `response.errors`:

```typescript
const body = await response.json();

// WRONG — HTTP status check is not enough
if (!response.ok) throw new Error('Request failed');

// CORRECT — check the GraphQL errors array
if (body.errors?.length) {
  const msg = body.errors.map((e: { message: string }) => e.message).join('; ');
  throw new Error(`Shopify GraphQL error: ${msg}`);
}
```

Common error codes:
- `THROTTLED` — rate limit hit; back off and retry
- `ACCESS_DENIED` — scope missing; check `shopify.app.toml` access scopes
- `NOT_FOUND` — resource does not exist

---

## Rate Limiting (Leaky Bucket)

Shopify uses a leaky-bucket cost model. Each query has a cost; the bucket refills at 50 points/second (standard) or 100 points/second (Plus).

When you receive a `THROTTLED` error or HTTP 429:

```typescript
async graphqlRequest(shopDomain: string, token: string, body: object, attempt = 0) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (res.status === 429) {
    if (attempt >= 5) throw new Error('Shopify rate limit: max retries exceeded');
    const delay = Math.min(1000 * 2 ** attempt, 30_000);
    await new Promise(r => setTimeout(r, delay));
    return this.graphqlRequest(shopDomain, token, body, attempt + 1);
  }

  return res.json();
}
```

Check the `X-Shopify-Shop-Api-Call-Limit` response header to monitor bucket usage.

---

## Bulk Operations

For datasets larger than ~10k records, use the Shopify Bulk Operations API instead of cursor pagination:

```graphql
mutation {
  bulkOperationRunQuery(
    query: """
    {
      orders {
        edges {
          node { id name }
        }
      }
    }
    """
  ) {
    bulkOperation { id status }
    userErrors { field message }
  }
}
```

Then poll `currentBulkOperation { status url }` until `status == COMPLETED`, then download the JSONL file from `url`.

Use bulk operations when:
- Fetching a full export of all historical records
- The dataset is expected to exceed 10k rows
- Real-time latency is not required

---

## Only Request Used Fields

Shopify charges query cost per field. Only request fields that are actually consumed:

```graphql
# BAD — fetches everything
orders { nodes { id name email customer { id email addresses { ... } } lineItems { ... } } }

# GOOD — only what you need
orders { nodes { id name createdAt } }
```

---

## API Version

Use API version `2026-04` (matches `shopify.app.toml`). Update both together when upgrading.
