import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Link,
  InlineStack,
  DataTable,
  Badge,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { APP_NAME } from "../constants";
import { ProductsList } from "../components/ProductsList";
import drizzleDb from "../db.server";
import { generationsTable, type Generation } from "../db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

const DEBUG_REQUESTS = process.env.DEBUG_REQUESTS === 'true' || process.env.NODE_ENV === 'development';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  if (DEBUG_REQUESTS) {
    console.log(`[APP_INDEX] Loading dashboard: ${url.pathname} | URL: ${request.url}`);
    
    // Log request details before authentication
    const shopParam = url.searchParams.get('shop');
    console.log(`[APP_INDEX] Shop from URL params: ${shopParam}`);
    console.log(`[APP_INDEX] Headers:`, Object.fromEntries(request.headers.entries()));
  }
  
  const { admin, session } = await authenticate.admin(request);
  
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

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

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
        variants: [{ id: variantId, price: "100.00" }],
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
  const { products, shop, generations, analyticsData } = useLoaderData<typeof loader>();
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



  // Helper function to render status badges
  const renderStatusBadge = (status: string) => {
    const statusMap = {
      completed: "success",
      processing: "info", 
      failed: "critical",
      fulfilled: "success",
      pending: "warning",
      shipped: "info",
    } as const;
    
    return <Badge tone={statusMap[status as keyof typeof statusMap] || "info"}>{status}</Badge>;
  };

  // Prepare table data for generations
  const generationsTableRows = generations.map((gen: Generation) => [
    gen.id.substring(0, 12) + "...", // Truncate long ID
    gen.customerId?.replace("gid://shopify/Customer/", "Customer ") || "Anonymous",
    gen.generationType.charAt(0).toUpperCase() + gen.generationType.slice(1),
    gen.aiPromptUsed.substring(0, 50) + (gen.aiPromptUsed.length > 50 ? "..." : ""),
    renderStatusBadge(gen.status || "pending"),
    new Date(gen.createdAt).toLocaleDateString(),
    gen.processingTimeMs ? `${(gen.processingTimeMs / 1000).toFixed(1)}s` : "-",
  ]);



  return (
    <Page>
      <TitleBar title={APP_NAME}>
        <button variant="primary" onClick={() => window.location.href = '/app/products'}>
          Enable Products
        </button>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg">
                    Welcome to {APP_NAME}
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Logged in as: <Text as="span" fontWeight="semibold">{shop}</Text>
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Create beautiful, custom posters of your pets using the power of AI. Enable products for pet customization, manage AI styles, and track generation orders.
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Get started by enabling products for AI pet generation and creating style collections for your customers to choose from.
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
                            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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

              {/* Recent Generations Table */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingLg">
                    Recent Generations
                  </Text>
                  <DataTable
                    columnContentTypes={[
                      'text',
                      'text', 
                      'text',
                      'text',
                      'text',
                      'text',
                      'text',
                    ]}
                    headings={[
                      'Generation ID',
                      'Customer',
                      'Type',
                      'AI Prompt',
                      'Status',
                      'Created',
                      'Processing Time',
                    ]}
                    rows={generationsTableRows}
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingLg">
                    Your Products
                  </Text>
                  <ProductsList products={products} shop={shop} />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    App template specs
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Framework
                      </Text>
                      <Link
                        url="https://remix.run"
                        target="_blank"
                        removeUnderline
                      >
                        Remix
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Database
                      </Text>
                      <Link
                        url="https://drizzle.team/"
                        target="_blank"
                        removeUnderline
                      >
                        Drizzle ORM
                      </Link>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        Interface
                      </Text>
                      <span>
                        <Link
                          url="https://polaris.shopify.com"
                          target="_blank"
                          removeUnderline
                        >
                          Polaris
                        </Link>
                        {", "}
                        <Link
                          url="https://shopify.dev/docs/apps/tools/app-bridge"
                          target="_blank"
                          removeUnderline
                        >
                          App Bridge
                        </Link>
                      </span>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        API
                      </Text>
                      <Link
                        url="https://shopify.dev/docs/api/admin-graphql"
                        target="_blank"
                        removeUnderline
                      >
                        GraphQL API
                      </Link>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
