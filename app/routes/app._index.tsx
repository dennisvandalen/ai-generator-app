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
  Box,
  List,
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

// Dummy data for generations
const dummyGenerations = [
  {
    id: "GEN001",
    customer: "John Doe",
    petName: "Fluffy",
    style: "Watercolor",
    status: "completed",
    createdAt: "2024-01-15",
    completedAt: "2024-01-15",
  },
  {
    id: "GEN002", 
    customer: "Sarah Smith",
    petName: "Max",
    style: "Oil Painting",
    status: "processing",
    createdAt: "2024-01-16",
    completedAt: null,
  },
  {
    id: "GEN003",
    customer: "Mike Johnson", 
    petName: "Bella",
    style: "Sketch",
    status: "completed",
    createdAt: "2024-01-16",
    completedAt: "2024-01-16",
  },
  {
    id: "GEN004",
    customer: "Emily Davis",
    petName: "Charlie",
    style: "Pop Art",
    status: "failed",
    createdAt: "2024-01-17",
    completedAt: null,
  },
  {
    id: "GEN005",
    customer: "David Wilson",
    petName: "Luna",
    style: "Realistic",
    status: "completed",
    createdAt: "2024-01-17", 
    completedAt: "2024-01-17",
  },
];

// Dummy data for orders
const dummyOrders = [
  {
    id: "ORD001",
    customer: "John Doe",
    product: "Fluffy Watercolor Print",
    amount: "$29.99",
    status: "fulfilled",
    orderDate: "2024-01-15",
  },
  {
    id: "ORD002",
    customer: "Sarah Smith", 
    product: "Max Oil Painting Print",
    amount: "$39.99",
    status: "pending",
    orderDate: "2024-01-16",
  },
  {
    id: "ORD003",
    customer: "Mike Johnson",
    product: "Bella Sketch Print", 
    amount: "$24.99",
    status: "fulfilled",
    orderDate: "2024-01-16",
  },
  {
    id: "ORD004",
    customer: "David Wilson",
    product: "Luna Realistic Print",
    amount: "$34.99", 
    status: "shipped",
    orderDate: "2024-01-17",
  },
];

// Dummy analytics data
const analyticsData = {
  totalGenerations: 156,
  successfulGenerations: 142,
  failedGenerations: 14,
  totalRevenue: 4567.89,
  averageOrderValue: 32.45,
  conversionRate: 78.2,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

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
    shop: session.shop 
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
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
  const { products, shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);
  const generateProduct = () => fetcher.submit({}, { method: "POST" });

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
  const generationsTableRows = dummyGenerations.map((gen) => [
    gen.id,
    gen.customer,
    gen.petName,
    gen.style,
    renderStatusBadge(gen.status),
    gen.createdAt,
    gen.completedAt || "-",
  ]);

  // Prepare table data for orders
  const ordersTableRows = dummyOrders.map((order) => [
    order.id,
    order.customer,
    order.product,
    order.amount,
    renderStatusBadge(order.status),
    order.orderDate,
  ]);

  return (
    <Page>
      <TitleBar title={APP_NAME}>
        <button variant="primary" onClick={() => window.location.href = '/app/generate'}>
          Generate a pet print
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
                  <Text variant="bodyMd" as="p">
                    Create beautiful, custom posters of your pets using the power of AI. Simply upload a photo of your furry friend and let our app transform it into stunning wall art that captures their unique personality.
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Get started by clicking the button below to create your first AI-generated pet poster.
                  </Text>
                  <Button variant="primary" url="/app/generate">
                    Create Pet Print
                  </Button>
                </BlockStack>
              </Card>

              {/* Analytics Overview Card */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Analytics Overview
                  </Text>
                  <Layout>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">
                            Total Generations
                          </Text>
                          <Text as="p" variant="headingXl">
                            {analyticsData.totalGenerations}
                          </Text>
                          <Text as="p" variant="bodyMd" tone="success">
                            +12% from last month
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
                            {((analyticsData.successfulGenerations / analyticsData.totalGenerations) * 100).toFixed(1)}%
                          </Text>
                          <ProgressBar 
                            progress={(analyticsData.successfulGenerations / analyticsData.totalGenerations) * 100} 
                            tone="success"
                          />
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd" tone="subdued">
                            Total Revenue
                          </Text>
                          <Text as="p" variant="headingXl">
                            ${analyticsData.totalRevenue.toLocaleString()}
                          </Text>
                          <Text as="p" variant="bodyMd" tone="success">
                            +8% from last month
                          </Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>

              {/* Simple Charts Section */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Generation Statistics
                  </Text>
                  <Layout>
                    <Layout.Section variant="oneHalf">
                      <BlockStack gap="300">
                        <Text as="h3" variant="headingMd">
                          Generation Status Breakdown
                        </Text>
                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text as="span">Successful</Text>
                              <Text as="span" tone="success">{analyticsData.successfulGenerations}</Text>
                            </InlineStack>
                            <ProgressBar progress={91} tone="success" />
                            
                            <InlineStack align="space-between">
                              <Text as="span">Failed</Text>
                              <Text as="span" tone="critical">{analyticsData.failedGenerations}</Text>
                            </InlineStack>
                            <ProgressBar progress={9} tone="critical" />
                          </BlockStack>
                        </Box>
                      </BlockStack>
                    </Layout.Section>
                    <Layout.Section variant="oneHalf">
                      <BlockStack gap="300">
                        <Text as="h3" variant="headingMd">
                          Popular Art Styles
                        </Text>
                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text as="span">Watercolor</Text>
                              <Text as="span">35%</Text>
                            </InlineStack>
                            <ProgressBar progress={35} />
                            
                            <InlineStack align="space-between">
                              <Text as="span">Oil Painting</Text>
                              <Text as="span">28%</Text>
                            </InlineStack>
                            <ProgressBar progress={28} />
                            
                            <InlineStack align="space-between">
                              <Text as="span">Realistic</Text>
                              <Text as="span">22%</Text>
                            </InlineStack>
                            <ProgressBar progress={22} />
                            
                            <InlineStack align="space-between">
                              <Text as="span">Other</Text>
                              <Text as="span">15%</Text>
                            </InlineStack>
                            <ProgressBar progress={15} />
                          </BlockStack>
                        </Box>
                      </BlockStack>
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
                      'Pet Name',
                      'Style', 
                      'Status',
                      'Created',
                      'Completed',
                    ]}
                    rows={generationsTableRows}
                  />
                </BlockStack>
              </Card>

              {/* Recent Orders Table */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingLg">
                    Recent Orders
                  </Text>
                  <DataTable
                    columnContentTypes={[
                      'text',
                      'text',
                      'text', 
                      'text',
                      'text',
                      'text',
                    ]}
                    headings={[
                      'Order ID',
                      'Customer',
                      'Product',
                      'Amount',
                      'Status', 
                      'Order Date',
                    ]}
                    rows={ordersTableRows}
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

              <Card>
                <BlockStack gap="500">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Congrats on creating a new Shopify app 🎉
                    </Text>
                    <Text variant="bodyMd" as="p">
                      This embedded app template uses{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/tools/app-bridge"
                        target="_blank"
                        removeUnderline
                      >
                        App Bridge
                      </Link>{" "}
                      interface examples like an{" "}
                      <Link url="/app/additional" removeUnderline>
                        additional page in the app nav
                      </Link>
                      , as well as an{" "}
                      <Link
                        url="https://shopify.dev/docs/api/admin-graphql"
                        target="_blank"
                        removeUnderline
                      >
                        Admin GraphQL
                      </Link>{" "}
                      mutation demo, to provide a starting point for app
                      development.
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">
                      Get started with products
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Generate a product with GraphQL and get the JSON output for
                      that product. Learn more about the{" "}
                      <Link
                        url="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
                        target="_blank"
                        removeUnderline
                      >
                        productCreate
                      </Link>{" "}
                      mutation in our API references.
                    </Text>
                  </BlockStack>
                  <InlineStack gap="300">
                    <Button loading={isLoading} onClick={generateProduct}>
                      Generate a product
                    </Button>
                    {fetcher.data?.product && (
                      <Button
                        url={`shopify:admin/products/${productId}`}
                        target="_blank"
                        variant="plain"
                      >
                        View product
                      </Button>
                    )}
                  </InlineStack>
                  {fetcher.data?.product && (
                    <>
                      <Text as="h3" variant="headingMd">
                        {" "}
                        productCreate mutation
                      </Text>
                      <Box
                        padding="400"
                        background="bg-surface-active"
                        borderWidth="025"
                        borderRadius="200"
                        borderColor="border"
                        overflowX="scroll"
                      >
                        <pre style={{ margin: 0 }}>
                          <code>
                            {JSON.stringify(fetcher.data.product, null, 2)}
                          </code>
                        </pre>
                      </Box>
                      <Text as="h3" variant="headingMd">
                        {" "}
                        productVariantsBulkUpdate mutation
                      </Text>
                      <Box
                        padding="400"
                        background="bg-surface-active"
                        borderWidth="025"
                        borderRadius="200"
                        borderColor="border"
                        overflowX="scroll"
                      >
                        <pre style={{ margin: 0 }}>
                          <code>
                            {JSON.stringify(fetcher.data.variant, null, 2)}
                          </code>
                        </pre>
                      </Box>
                    </>
                  )}
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
                        url="https://www.prisma.io/"
                        target="_blank"
                        removeUnderline
                      >
                        Prisma
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
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Next steps
                  </Text>
                  <List>
                    <List.Item>
                      Build an{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/getting-started/build-app-example"
                        target="_blank"
                        removeUnderline
                      >
                        {" "}
                        example app
                      </Link>{" "}
                      to get started
                    </List.Item>
                    <List.Item>
                      Explore Shopify's API with{" "}
                      <Link
                        url="https://shopify.dev/docs/apps/tools/graphiql-admin-api"
                        target="_blank"
                        removeUnderline
                      >
                        GraphiQL
                      </Link>
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
