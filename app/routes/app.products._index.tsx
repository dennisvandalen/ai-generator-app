import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

import { useLoaderData, useFetcher, useNavigate, useLocation } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  InlineStack,
  EmptyState,
  Thumbnail,
  IndexTable,
  Badge,
  Page,
  Select,
  ChoiceList,
} from "@shopify/polaris";
import { PlusIcon, StoreIcon, ImageIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";
import drizzleDb from "../db.server";
import { productsTable, type Product, type NewProduct } from "~/db/schema";
import {asc, desc, eq} from "drizzle-orm";
import { randomUUID } from "crypto";

// Types for the selected product from Resource Picker
interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  images: Array<{
    id: string;
    altText?: string;
    originalSrc: string;
  }>;
  vendor: string;
  productType: string;
}

type ActionData =
  | { error: string; success?: undefined; message?: undefined }
  | { success: true; message: string; error?: undefined };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  let sortField = 'isEnabled';
  let sortDirection = 'desc';
  let statusFilter = null;

  // Check if this is a form submission (from fetcher)
  if (request.method === 'GET' && request.headers.get('Content-Type')?.includes('multipart/form-data')) {
    const formData = await request.formData();
    const action = formData.get('_action');

    if (action === 'updateSort') {
      sortField = formData.get('sortField')?.toString() || 'isEnabled';
      sortDirection = formData.get('sortDirection')?.toString() || 'desc';
      // Preserve existing filter if any
      statusFilter = url.searchParams.get('status');
    } else if (action === 'updateFilter') {
      statusFilter = formData.get('status')?.toString() || null;
      // Preserve existing sort if any
      sortField = url.searchParams.get('sortField') || 'isEnabled';
      sortDirection = url.searchParams.get('sortDirection') || 'desc';
    }
  } else {
    // Get parameters from URL for regular page loads
    sortField = url.searchParams.get('sortField') || 'isEnabled';
    sortDirection = url.searchParams.get('sortDirection') || 'desc';
    statusFilter = url.searchParams.get('status');
  }

  // Build query
  let query = drizzleDb
    .select()
    .from(productsTable)
    .where(eq(productsTable.shopId, session.shop));

  // Apply status filter if provided
  if (statusFilter === 'enabled') {
    query = query.where(eq(productsTable.isEnabled, true));
  } else if (statusFilter === 'disabled') {
    query = query.where(eq(productsTable.isEnabled, false));
  }

  // Apply sorting
  if (sortField === 'title') {
    query = query.orderBy(sortDirection === 'asc' ? asc(productsTable.title) : desc(productsTable.title));
  } else if (sortField === 'updatedAt') {
    query = query.orderBy(sortDirection === 'asc' ? asc(productsTable.updatedAt) : desc(productsTable.updatedAt));
  } else if (sortField === 'isEnabled') {
    query = query.orderBy(sortDirection === 'asc' ? asc(productsTable.isEnabled) : desc(productsTable.isEnabled));
  } else {
    // Default to createdAt
    query = query.orderBy(sortDirection === 'asc' ? asc(productsTable.createdAt) : desc(productsTable.createdAt));
  }

  const products = await query;

  return Response.json({
    shop: session.shop,
    products,
    currentSort: { field: sortField, direction: sortDirection },
    currentFilter: statusFilter || 'all',
  });
};

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "create_product") {
    const productData = formData.get("productData");

    if (!productData) {
      const data: ActionData = { error: "No product data provided" };
      return Response.json(data, { status: 400 });
    }

    try {
      const selectedProduct: ShopifyProduct = JSON.parse(productData as string);

      // Extract numeric ID from GID (e.g., "gid://shopify/Product/15020147966338" -> 15020147966338)
      const productIdNumber = parseInt(selectedProduct.id.replace('gid://shopify/Product/', ''), 10);

      // Check if product already exists
      const existingProduct = await drizzleDb
        .select()
        .from(productsTable)
        .where(eq(productsTable.shopifyProductId, productIdNumber))
        .limit(1);

      if (existingProduct.length > 0) {
        const data: ActionData = { error: "Product is already enabled for AI generation" };
        return Response.json(data, { status: 400 });
      }

      // Create new product in database
      const newProduct: NewProduct = {
        uuid: randomUUID(),
        shopId: session.shop,
        shopifyProductId: productIdNumber,
        title: selectedProduct.title,
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await drizzleDb.insert(productsTable).values(newProduct);

      const data: ActionData = { success: true, message: "Product enabled for AI generation" };
      return Response.json(data);
    } catch (error) {
      console.error("Error creating product:", error);
      const data: ActionData = { error: "Failed to enable product for AI generation" };
      return Response.json(data, { status: 500 });
    }
  }

  const data: ActionData = { error: "Invalid action" };
  return Response.json(data, { status: 400 });
};

export default function ProductsIndexPage() {
  const { products, currentSort, currentFilter } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const sortFetcher = useFetcher();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update URL when sort/filter changes without affecting scroll position
  useEffect(() => {
    if (sortFetcher.state === 'idle' && sortFetcher.data) {
      const data = sortFetcher.data as any;
      if (data.currentSort || data.currentFilter) {
        const params = new URLSearchParams(location.search);

        // Update sort parameters if they exist in the fetcher data
        if (data.currentSort) {
          params.set('sortField', data.currentSort.field);
          params.set('sortDirection', data.currentSort.direction);
        }

        // Update filter parameter if it exists in the fetcher data
        if (data.currentFilter && data.currentFilter !== 'all') {
          params.set('status', data.currentFilter);
        } else if (data.currentFilter === 'all') {
          params.delete('status');
        }

        // Update URL without affecting scroll position
        navigate(`${location.pathname}?${params.toString()}`, {
          replace: true,
          preventScrollReset: true
        });
      }
    }
  }, [sortFetcher.state, sortFetcher.data, navigate, location]);

  // Handle sort change
  const handleSortChange = useCallback((value: string) => {
    const [field, direction] = value.split('-');
    const formData = new FormData();
    formData.append('_action', 'updateSort');
    formData.append('sortField', field);
    formData.append('sortDirection', direction);
    sortFetcher.submit(formData, { method: 'get' });
  }, [sortFetcher]);

  // Handle filter change
  const handleFilterChange = useCallback((value: string) => {
    const formData = new FormData();
    formData.append('_action', 'updateFilter');
    if (value !== 'all') {
      formData.append('status', value);
    }
    sortFetcher.submit(formData, { method: 'get' });
  }, [sortFetcher]);

  const handleProductClick = useCallback((productUuid: string) => {
    navigate(`/app/products/${productUuid}`);
  }, [navigate]);

  const handleProductSelection = useCallback(async () => {
    try {
      setIsSubmitting(true);

      // Use the modern Resource Picker API
      const selected = await (window as any).shopify.resourcePicker({
        type: 'product',
        action: 'select',
        multiple: false, // Only allow single product selection
        filter: {
          variants: false, // Don't show variants in picker
          draft: true, // Include draft products
          archived: false, // Exclude archived products
        }
      });

      if (selected && selected.length > 0) {
        const selectedProduct = selected[0];

        // Submit the product data to create it in the database
        const formData = new FormData();
        formData.append("action", "create_product");
        formData.append("productData", JSON.stringify(selectedProduct));

        fetcher.submit(formData, { method: "post" });
      }
    } catch (error) {
      console.error("Error selecting product:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [fetcher]);

  const handleCreateNewProduct = useCallback(async () => {
    try {
      setIsSubmitting(true);

      // Redirect to Shopify's product creation page
      await (window as any).shopify.actions.Redirect.create({
        url: `/admin/products/new`,
      });

      console.log("Redirecting to create new product");

    } catch (error) {
      console.error("Error creating new product:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const resourceName = {
    singular: 'product',
    plural: 'products',
  };

  const productsMarkup = products.length ? (
    <IndexTable
      resourceName={resourceName}
      itemCount={products.length}
      headings={[
        { title: 'Product' },
        { title: 'Status' },
        { title: 'Added' },
      ]}
      selectable={false}
    >
      {products.map(
        (product: Product, index: number) => {
          const { id, uuid, title, shopifyProductId, isEnabled, createdAt } = product;
          return (
            <IndexTable.Row
              id={id.toString()}
              key={id}
              position={index}
            >
              <IndexTable.Cell>
                <InlineStack gap="300" align="start">
                  <Thumbnail
                    source={ImageIcon}
                    alt={title}
                    size="small"
                  />
                  <BlockStack gap="100">
                    <span
                      onClick={() => handleProductClick(uuid)}
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      <Text
                        variant="bodyMd"
                        fontWeight="semibold"
                        as="span"
                        tone="base"
                      >
                        {title}
                      </Text>
                    </span>
                    <Text variant="bodySm" tone="subdued" as="span">
                      Product ID: {shopifyProductId}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={isEnabled ? "success" : "attention"}>
                  {isEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Text variant="bodySm" as="span">
                  {new Date(createdAt).toLocaleDateString()}
                </Text>
              </IndexTable.Cell>
            </IndexTable.Row>
          );
        }
      )}
    </IndexTable>
  ) : (
    <EmptyState
      heading="No AI-enabled products yet"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Start by enabling products for AI pet generation. Customers will be able to upload pet photos and customize these products with AI-generated pet artwork.</p>
      <Button onClick={handleProductSelection} variant="primary">
        Select Product from Store
      </Button>
    </EmptyState>
  );

  return (
    <Page title="Products">
      <TitleBar title="Products" />

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingLg">
                    AI-Enabled Products
                  </Text>
                </InlineStack>

                <Text variant="bodyMd" as="p">
                  Manage which products customers can customize with AI-generated pet artwork.
                  Enable products to allow customers to upload pet photos and select AI styles.
                </Text>

                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">
                    Add Products for AI Generation
                  </Text>

                  <Layout>
                    <Layout.Section variant="oneHalf">
                      <Card>
                        <BlockStack gap="300">
                          <BlockStack gap="200">
                            <Text variant="headingSm" as="h4">
                              Create New Product
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Create a brand new product specifically designed for AI pet customization.
                            </Text>
                          </BlockStack>
                          <Button
                            variant="primary"
                            onClick={handleCreateNewProduct}
                            loading={isSubmitting}
                            disabled={isSubmitting}
                            size="large"
                            fullWidth
                            icon={PlusIcon}
                          >
                            Create New Product
                          </Button>
                        </BlockStack>
                      </Card>
                    </Layout.Section>

                    <Layout.Section variant="oneHalf">
                      <Card>
                        <BlockStack gap="300">
                          <BlockStack gap="200">
                            <Text variant="headingSm" as="h4">
                              Select Existing Product
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Choose from products already in your store to enable for AI pet generation.
                            </Text>
                          </BlockStack>
                          <Button
                            variant="secondary"
                            onClick={handleProductSelection}
                            loading={isSubmitting || fetcher.state === "submitting"}
                            disabled={isSubmitting || fetcher.state === "submitting"}
                            size="large"
                            fullWidth
                            icon={StoreIcon}
                          >
                            Select from Store
                          </Button>
                          {fetcher.data && 'error' in fetcher.data && (
                            <Text variant="bodySm" tone="critical" as="p">
                              {fetcher.data.error}
                            </Text>
                          )}
                          {fetcher.data && 'success' in fetcher.data && (
                            <Text variant="bodySm" tone="success" as="p">
                              {fetcher.data.message}
                            </Text>
                          )}
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              {products.length > 0 && (
                <BlockStack gap="400">
                  <InlineStack align="space-between" wrap={false}>
                    <Select
                      label="Sort by"
                      labelInline
                      options={[
                        { label: 'Newest first', value: 'createdAt-desc' },
                        { label: 'Oldest first', value: 'createdAt-asc' },
                        { label: 'Last updated', value: 'updatedAt-desc' },
                        { label: 'Title A-Z', value: 'title-asc' },
                        { label: 'Title Z-A', value: 'title-desc' },
                        { label: 'Status (enabled first)', value: 'isEnabled-desc' },
                        { label: 'Status (disabled first)', value: 'isEnabled-asc' },
                      ]}
                      value={`${currentSort.field}-${currentSort.direction}`}
                      onChange={handleSortChange}
                    />
                    <ChoiceList
                      title="Filter by status"
                      titleHidden
                      choices={[
                        { label: 'All products', value: 'all' },
                        { label: 'Enabled only', value: 'enabled' },
                        { label: 'Disabled only', value: 'disabled' },
                      ]}
                      selected={[currentFilter]}
                      onChange={(selected) => handleFilterChange(selected[0])}
                    />
                  </InlineStack>
                </BlockStack>
              )}
              {productsMarkup}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
