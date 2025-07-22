import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return {
    shop: session.shop,
    analytics: {
      totalGenerations: 0,
      totalRevenue: 0,
      popularStyles: [],
      customerInsights: {},
    },
  };
};

export default function AnalyticsPage() {
  const { analytics } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Analytics" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Analytics & Reports
                  </Text>

                  <Text variant="bodyMd" as="p">
                    Comprehensive analytics for pet generation reports, revenue, style performance, and customer insights.
                  </Text>
                </BlockStack>
              </Card>

              {/* Analytics Overview */}
              <Layout>
                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd" tone="subdued">Pet Generation Reports</Text>
                      <Text as="p" variant="headingXl">{analytics.totalGenerations}</Text>
                      <Text as="p" variant="bodyMd">Total pet AI generations</Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>
                <Layout.Section variant="oneHalf">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd" tone="subdued">Revenue Analytics</Text>
                      <Text as="p" variant="headingXl">${analytics.totalRevenue}</Text>
                      <Text as="p" variant="bodyMd">Total revenue from AI pet products</Text>
                    </BlockStack>
                  </Card>
                </Layout.Section>
              </Layout>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Coming Soon</Text>
                  <Text variant="bodyMd" as="p">
                    Detailed analytics including popular styles, customer insights, and performance metrics will be available soon.
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
