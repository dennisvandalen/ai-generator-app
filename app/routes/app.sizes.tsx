import type { LoaderFunctionArgs } from "@remix-run/node";
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
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  return { 
    shop: session.shop,
    sizes: [], // Placeholder
  };
};

export default function SizesPage() {
  const { shop, sizes } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Size Management" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">
                      Product Size Variants
                    </Text>
                    <Button variant="primary">Add New Size</Button>
                  </InlineStack>

                  <Text variant="bodyMd" as="p">
                    Manage available size variants for AI-generated pet products. Each size can have different dimensions and AI prompts.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <EmptyState
                  heading="No sizes configured yet"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Add size variants like A4, A3, Poster, etc. Each size can have unique dimensions and AI generation settings for pet artwork.</p>
                </EmptyState>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
} 