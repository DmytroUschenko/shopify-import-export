import { useLoaderData } from "react-router";
import { Page, Layout, Card, Text, BlockStack, InlineStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "react-router";

interface Stats {
  orders: number;
  customers: number;
  products: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  let stats: Stats = { orders: 0, customers: 0, products: 0 };
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL}/api/entities/stats`);
    if (response.ok) {
      stats = (await response.json()) as Stats;
    }
  } catch {
    // API unavailable during initial setup — return zeroed stats
  }

  return { stats };
}

export default function Index() {
  const { stats } = useLoaderData<typeof loader>();

  const statCards: Array<{ label: string; value: number }> = [
    { label: "Orders", value: stats.orders },
    { label: "Customers", value: stats.customers },
    { label: "Products", value: stats.products },
  ];

  return (
    <Page title="Shopify Import — Dashboard">
      <Layout>
        <Layout.Section>
          <InlineStack gap="400" wrap>
            {statCards.map(({ label, value }) => (
              <Card key={label}>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    {label}
                  </Text>
                  <Text variant="heading2xl" as="p">
                    {value.toLocaleString()}
                  </Text>
                </BlockStack>
              </Card>
            ))}
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
