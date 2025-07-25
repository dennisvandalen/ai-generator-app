import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  InlineStack,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";
import { boundary } from "@shopify/shopify-app-remix/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return {
    shop: session.shop,
    readyDownloads: [], // Placeholder
    processingQueue: [], // Placeholder
  };
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function DownloadsPage() {
  const { readyDownloads, processingQueue } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Download Center" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">
                      Download Center
                    </Text>
                    <Button>Export All Files</Button>
                  </InlineStack>

                  <Text variant="bodyMd" as="p">
                    Access and download high-resolution AI-generated pet artwork for completed orders.
                    Files are automatically generated after order placement.
                  </Text>

                  {/* Quick Stats */}
                  <Layout>
                    <Layout.Section variant="oneHalf">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">Ready Downloads</Text>
                          <Text as="p" variant="headingXl">{readyDownloads.length}</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneHalf">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">Processing Queue</Text>
                          <Text as="p" variant="headingXl">{processingQueue.length}</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>

              <Card>
                <EmptyState
                  heading="No downloads available yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>High-resolution AI-generated pet artwork will appear here after orders are placed and processed.</p>
                </EmptyState>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
