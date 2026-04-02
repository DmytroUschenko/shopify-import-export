import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  ProgressBar,
  Select,
  Banner,
  Text,
  BlockStack,
  FormLayout,
} from "@shopify/polaris";
import { EntityType } from "@shopify-import/shared";
import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const POLL_INTERVAL_MS = 2000;

interface BulkStartResult {
  jobId: string;
}

interface BulkStatusResult {
  progress: number;
  status: "waiting" | "active" | "completed" | "failed";
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "start") {
    const entityType = formData.get("entityType") as string;
    const response = await fetch(`${process.env.API_INTERNAL_URL}/api/import/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType }),
    });

    if (!response.ok) {
      return { error: "Failed to start import", jobId: null, progress: null };
    }
    const data = (await response.json()) as BulkStartResult;
    return { jobId: data.jobId, error: null, progress: 0 };
  }

  if (intent === "poll") {
    const jobId = formData.get("jobId") as string;
    const response = await fetch(
      `${process.env.API_INTERNAL_URL}/api/import/bulk/status/${jobId}`
    );
    if (!response.ok) {
      return { error: "Status check failed", jobId, progress: null };
    }
    const data = (await response.json()) as BulkStatusResult;
    return { jobId, progress: data.progress, status: data.status, error: null };
  }

  return { error: "Unknown intent", jobId: null, progress: null };
}

export default function ImportPage() {
  const fetcher = useFetcher<typeof action>();
  const [entityType, setEntityType] = useState<string>(EntityType.Order);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const entityOptions = Object.values(EntityType).map((v) => ({
    label: v.charAt(0).toUpperCase() + v.slice(1) + "s",
    value: v,
  }));

  const isSubmitting = fetcher.state === "submitting";
  const result = fetcher.data;
  const jobId = result && "jobId" in result ? result.jobId : null;
  const progress = result && "progress" in result ? (result.progress ?? 0) : 0;
  const isDone =
    result && "status" in result && result.status === "completed";

  // Poll for progress once a job is running
  useEffect(() => {
    if (jobId && !isDone) {
      pollRef.current = setInterval(() => {
        fetcher.submit({ intent: "poll", jobId }, { method: "post" });
      }, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, isDone]);

  return (
    <Page title="Bulk Import">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Import historical Shopify data
              </Text>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="start" />
                <FormLayout>
                  <Select
                    label="Entity type"
                    options={entityOptions}
                    value={entityType}
                    onChange={setEntityType}
                    name="entityType"
                  />
                  <Button
                    submit
                    loading={isSubmitting}
                    variant="primary"
                    disabled={isSubmitting || (!!jobId && !isDone)}
                  >
                    Start import
                  </Button>
                </FormLayout>
              </fetcher.Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {result && "error" in result && result.error && (
          <Layout.Section>
            <Banner title="Import error" tone="critical">
              <Text as="p">{result.error}</Text>
            </Banner>
          </Layout.Section>
        )}

        {jobId && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  {isDone ? "Import complete" : "Import in progress…"}
                </Text>
                <ProgressBar
                  progress={progress}
                  tone={isDone ? "success" : "primary"}
                />
                <Text as="p" tone="subdued">
                  Job ID: {jobId}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
