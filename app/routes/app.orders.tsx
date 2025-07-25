import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-remix/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return {
    shop: session.shop,
    orders: [], // Placeholder
  };
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function OrdersPage() {
  useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Orders" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Orders with AI Pet Products
                  </Text>

                  <Text variant="bodyMd" as="p">
                    Track orders containing AI-generated pet products and their fulfillment status.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <EmptyState
                  heading="No AI product orders yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Orders containing AI-generated pet products will appear here for tracking and fulfillment.</p>
                </EmptyState>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
