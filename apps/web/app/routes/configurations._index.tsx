import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  Tabs,
  FormLayout,
  TextField,
  Checkbox,
  Button,
  InlineStack,
  Banner,
  Text,
  BlockStack,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

interface ConfigItem {
  path: string;
  group: string;
  groupLabel: string;
  label: string;
  type: "string" | "boolean" | "password";
  description?: string;
  writeOnly: boolean;
  value: string | null;
}

interface ConfigGroup {
  group: string;
  label: string;
  items: ConfigItem[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    const res = await fetch(
      `${process.env.API_INTERNAL_URL}/api/configuration/${encodeURIComponent(shopDomain)}`
    );
    const groups: ConfigGroup[] = res.ok ? ((await res.json()) as ConfigGroup[]) : [];
    return { shopDomain, groups };
  } catch {
    return { shopDomain, groups: [] };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const configPath = formData.get("configPath") as string | null;

  if (intent === "save-one" && configPath) {
    const value = (formData.get("value") as string) || null;
    try {
      const res = await fetch(
        `${process.env.API_INTERNAL_URL}/api/configuration/${encodeURIComponent(shopDomain)}/${configPath}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        }
      );
      if (!res.ok) {
        return { success: false, error: "Failed to save", savedPath: configPath, savedGroup: null };
      }
      return { success: true, error: null, savedPath: configPath, savedGroup: null };
    } catch {
      return { success: false, error: "Unexpected error", savedPath: configPath, savedGroup: null };
    }
  }

  // intent === "save-group"
  const group = formData.get("group") as string;
  const updates: Record<string, string | null> = {};
  for (const [key, val] of formData.entries()) {
    if (key.startsWith("path:")) {
      updates[key.slice(5)] = (val as string) || null;
    }
  }

  try {
    const res = await fetch(
      `${process.env.API_INTERNAL_URL}/api/configuration/${encodeURIComponent(shopDomain)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );
    if (!res.ok) {
      return { success: false, error: "Failed to save group", savedGroup: group, savedPath: null };
    }
    return { success: true, error: null, savedGroup: group, savedPath: null };
  } catch {
    return { success: false, error: "Unexpected error", savedGroup: group, savedPath: null };
  }
}

export default function ConfigurationsPage() {
  const { groups } = useLoaderData<typeof loader>();
  // Single fetcher for per-field saves (save-one intent)
  const fieldFetcher = useFetcher<typeof action>();
  // Single fetcher for save-group (save all in tab)
  const groupFetcher = useFetcher<typeof action>();

  const [selectedTab, setSelectedTab] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of groups) {
      for (const item of group.items) {
        initial[item.path] = (!item.writeOnly && item.value) ? item.value : "";
      }
    }
    return initial;
  });

  if (groups.length === 0) {
    return (
      <Page title="Configurations">
        <Layout>
          <Layout.Section>
            <Card>
              <Text as="p">No configuration groups registered.</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const currentGroup = groups[selectedTab];
  const isSavingGroup = groupFetcher.state === "submitting";
  const isSavingField = fieldFetcher.state === "submitting";
  const fieldResult = fieldFetcher.data;
  const groupResult = groupFetcher.data;

  function handleFieldChange(path: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [path]: value }));
  }

  return (
    <Page title="Configurations">
      <Layout>
        <Layout.Section>
          <Card>
            <Tabs
              tabs={groups.map((g) => ({ id: g.group, content: g.label }))}
              selected={selectedTab}
              onSelect={setSelectedTab}
            >
              <BlockStack gap="400">
                {groupResult && !groupResult.success && groupResult.error && (
                  <Banner title="Save failed" tone="critical">
                    <Text as="p">{groupResult.error}</Text>
                  </Banner>
                )}
                {groupResult?.success && groupResult.savedGroup === currentGroup.group && (
                  <Banner title="Saved" tone="success">
                    <Text as="p">All settings saved successfully.</Text>
                  </Banner>
                )}
                {fieldResult && !fieldResult.success && fieldResult.error && (
                  <Banner title="Save failed" tone="critical">
                    <Text as="p">{fieldResult.error}</Text>
                  </Banner>
                )}

                <FormLayout>
                  {currentGroup.items.map((item, idx) => {
                    const currentValue = fieldValues[item.path] ?? "";
                    const isSavingThis =
                      isSavingField &&
                      fieldFetcher.formData?.get("configPath") === item.path;

                    return (
                      <div key={item.path}>
                        {idx > 0 && <Divider />}
                        {item.type === "boolean" ? (
                          <InlineStack gap="200" align="start" blockAlign="center">
                            <Checkbox
                              label={item.label}
                              helpText={item.description}
                              checked={currentValue === "true"}
                              onChange={(checked) =>
                                handleFieldChange(item.path, String(checked))
                              }
                            />
                            <fieldFetcher.Form method="post">
                              <input type="hidden" name="intent" value="save-one" />
                              <input type="hidden" name="configPath" value={item.path} />
                              <input type="hidden" name="value" value={currentValue} />
                              <Button submit size="slim" loading={isSavingThis}>
                                Save
                              </Button>
                            </fieldFetcher.Form>
                          </InlineStack>
                        ) : (
                          <fieldFetcher.Form method="post">
                            <input type="hidden" name="intent" value="save-one" />
                            <input type="hidden" name="configPath" value={item.path} />
                            <InlineStack gap="200" align="end" blockAlign="end">
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label={item.label}
                                  name="value"
                                  type={item.type === "password" ? "password" : "text"}
                                  value={currentValue}
                                  onChange={(v) => handleFieldChange(item.path, v)}
                                  helpText={
                                    item.description ??
                                    (item.writeOnly
                                      ? "Leave blank to keep the existing value."
                                      : undefined)
                                  }
                                  autoComplete="off"
                                />
                              </div>
                              <Button submit size="slim" loading={isSavingThis}>
                                Save
                              </Button>
                            </InlineStack>
                          </fieldFetcher.Form>
                        )}
                      </div>
                    );
                  })}
                </FormLayout>

                <Divider />

                <groupFetcher.Form method="post">
                  <input type="hidden" name="intent" value="save-group" />
                  <input type="hidden" name="group" value={currentGroup.group} />
                  {currentGroup.items.map((item) => (
                    <input
                      key={item.path}
                      type="hidden"
                      name={`path:${item.path}`}
                      value={fieldValues[item.path] ?? ""}
                    />
                  ))}
                  <Button submit variant="primary" loading={isSavingGroup}>
                    Save All
                  </Button>
                </groupFetcher.Form>
              </BlockStack>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

