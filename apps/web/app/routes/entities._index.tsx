import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Select,
  Pagination,
  BlockStack,
  Text,
  Badge,
} from "@shopify/polaris";
import { EntityType } from "@shopify-import/shared";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "react-router";

const PAGE_SIZE = 25;

interface ImportRecord {
  id: string;
  entityId: string;
  entityType: string;
  status: string;
  updatedAt: string;
}

interface EntitiesResponse {
  items: ImportRecord[];
  total: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const entityType = (url.searchParams.get("type") ?? EntityType.Order) as EntityType;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));

  let entities: ImportRecord[] = [];
  let total = 0;

  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL}/api/entities?type=${entityType}&page=${page}&limit=${PAGE_SIZE}`
    );
    if (response.ok) {
      const data = (await response.json()) as EntitiesResponse;
      entities = data.items;
      total = data.total;
    }
  } catch {
    // API unavailable — return empty list
  }

  return { entities, total, entityType, page };
}

export default function EntitiesPage() {
  const { entities, total, entityType, page } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const entityOptions = Object.values(EntityType).map((v) => ({
    label: v.charAt(0).toUpperCase() + v.slice(1) + "s",
    value: v,
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    navigate(`?${params.toString()}`);
  }

  const rows = entities.map((e) => [
    e.entityId,
    e.entityType,
    <Badge
      key={e.id}
      tone={e.status === "processed" || e.status === "bulk_imported" ? "success" : "attention"}
    >
      {e.status}
    </Badge>,
    new Date(e.updatedAt).toLocaleString(),
  ]);

  return (
    <Page title="Imported Entities">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Select
                label="Entity type"
                options={entityOptions}
                value={entityType}
                onChange={(v) => {
                  updateParam("type", v);
                  updateParam("page", "1");
                }}
              />
              {entities.length === 0 ? (
                <Text as="p" tone="subdued">
                  No records found. Run a bulk import or wait for webhooks.
                </Text>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Shopify ID", "Type", "Status", "Last updated"]}
                  rows={rows}
                  footerContent={`${total.toLocaleString()} total records`}
                />
              )}
              <Pagination
                hasPrevious={page > 1}
                onPrevious={() => updateParam("page", String(page - 1))}
                hasNext={page < totalPages}
                onNext={() => updateParam("page", String(page + 1))}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
