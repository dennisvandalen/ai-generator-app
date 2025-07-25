import {useEffect} from "react";
import { boundary } from "@shopify/shopify-app-remix/server";
import type {ActionFunctionArgs, LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import {useFetcher, useLoaderData} from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Link,
  InlineStack,
  ProgressBar,
} from "@shopify/polaris";
import {Modal, TitleBar, useAppBridge} from "@shopify/app-bridge-react";
import {authenticate} from "~/shopify.server";
import {APP_NAME} from "~/constants";
import drizzleDb from "../db.server";
import {generationsTable} from "~/db/schema";
import {eq, desc, and, gte} from "drizzle-orm";
import {Onboarding} from "~/components/Onboarding";

const DEBUG_REQUESTS = process.env.DEBUG_REQUESTS === 'true' || process.env.NODE_ENV === 'development';

export const loader = async ({request}: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (DEBUG_REQUESTS) {
    console.log(`[APP_INDEX] Loading dashboard: ${url.pathname} | URL: ${request.url}`);

    // Log request details before authentication
    const shopParam = url.searchParams.get('shop');
    console.log(`[APP_INDEX] Shop from URL params: ${shopParam}`);
    console.log(`[APP_INDEX] Headers:`, Object.fromEntries(request.headers.entries()));
  }

  const {admin, session} = await authenticate.admin(request);

  if (DEBUG_REQUESTS) {
    // Log session details after authentication
    console.log(`[APP_INDEX] Session shop: ${session?.shop || 'null'}`);
    console.log(`[APP_INDEX] Session details:`, {
      id: session?.id,
      shop: session?.shop,
      isOnline: session?.isOnline,
      expires: session?.expires,
    });
  }

  // Get start of current month for filtering
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch recent generations for display (limited)
  const generations = await drizzleDb
    .select()
    .from(generationsTable)
    .where(eq(generationsTable.shopId, session.shop))
    .orderBy(desc(generationsTable.createdAt))
    .limit(20);

  // Get all generations for this month for accurate analytics
  const monthlyGenerations = await drizzleDb
    .select()
    .from(generationsTable)
    .where(
      and(
        eq(generationsTable.shopId, session.shop),
        gte(generationsTable.createdAt, startOfMonth)
      )
    );

  // Calculate analytics from this month's data
  const totalGenerations = monthlyGenerations.length;
  const successfulGenerations = monthlyGenerations.filter(g => g.status === 'completed').length;
  const processingGenerations = monthlyGenerations.filter(g => g.status === 'processing' || g.status === 'pending').length;

  const analyticsData = {
    totalGenerations,
    successfulGenerations,
    processingGenerations,
    conversionRate: totalGenerations > 0 ? (successfulGenerations / totalGenerations) * 100 : 0,
  };

  const response = await admin.graphql(
    `#graphql
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              status
              createdAt
              updatedAt
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        first: 10,
      },
    },
  );

  const responseJson = await response.json();
  const products = responseJson.data?.products?.edges || [];

  return {
    products,
    shop: session.shop,
    generations,
    analyticsData,
  };
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export const action = async ({request}: ActionFunctionArgs) => {
  const {admin} = await authenticate.admin(request);

  // Original product creation logic
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
    ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{id: variantId, price: "100.00"}],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
    variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const {analyticsData} = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const shopify = useAppBridge();
  const fetcherData = fetcher.data as any;
  const productId = fetcherData?.product?.id?.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  return (
    <Page title={APP_NAME}>
      <TitleBar title={APP_NAME}>
        {/*<button variant="primary" onClick={() => window.location.href = '/app/products'}>*/}
        {/*  Enable Products*/}
        {/*</button>*/}
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">

              <Onboarding/>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg">
                    Welcome to {APP_NAME}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Create beautiful, custom posters of your pets using the power of AI. Enable products for pet
                    customization, manage AI styles, and track generation orders.
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Get started by enabling products for AI pet generation and creating style collections for your
                    customers to choose from.
                  </Text>
                  <Button variant="primary" url="/app/products">
                    Enable Products for AI
                  </Button>
                </BlockStack>
              </Card>

              {/* Analytics Overview Card */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">
                      Analytics Overview
                    </Text>
                    <Button url="/app/generations" variant="plain">
                      View All Generations
                    </Button>
                  </InlineStack>
                  <Layout>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">
                            This Month's Generations
                          </Text>
                          <Text as="p" variant="headingXl">
                            {analyticsData.totalGenerations}
                          </Text>
                          <Text as="p" variant="bodyMd" tone="success">
                            {new Date().toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}
                          </Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">
                            Success Rate
                          </Text>
                          <Text as="p" variant="headingXl">
                            {analyticsData.totalGenerations > 0 ? analyticsData.conversionRate.toFixed(1) : '0'}%
                          </Text>
                          <ProgressBar
                            progress={analyticsData.totalGenerations > 0 ? analyticsData.conversionRate : 0}
                            tone="success"
                          />
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">
                            Processing Queue
                          </Text>
                          <Text as="p" variant="headingXl">
                            {analyticsData.processingGenerations}
                          </Text>
                          <Text as="p" variant="bodyMd">
                            Currently processing
                          </Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg">
                    Quick Actions
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Use the buttons below to quickly create products or manage your AI styles.
                  </Text>
                  <InlineStack gap="200">
                    <Button
                      onClick={() => fetcher.submit({}, {method: 'post'})}
                      loading={fetcher.state === 'submitting'}
                    >
                      Create New Product
                    </Button>
                    <Link url="/app/styles">
                      Manage AI Styles
                    </Link>
                    <Button onClick={() => shopify.modal.show('test-modal')}>
                      Open Test Modal
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal id="test-modal" src="/modals/my-dummy-route" variant={'max'}>
        <TitleBar title="Test Modal">
          <button onClick={() => shopify.modal.hide('test-modal')}>Close</button>
        </TitleBar>
      </Modal>
    </Page>
  );
}
