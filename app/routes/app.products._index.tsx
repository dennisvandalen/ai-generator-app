import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import { useState, useCallback } from "react";
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
} from "@shopify/polaris";
import { PlusIcon, StoreIcon, ImageIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import drizzleDb from "../db.server";
import { productsTable, type Product, type NewProduct } from "../db/schema";
import { eq } from "drizzle-orm";
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
  
  // Fetch AI-enabled products from database
  const products = await drizzleDb
    .select()
    .from(productsTable)
    .where(eq(productsTable.shopId, session.shop))
    .orderBy(productsTable.createdAt);
  
  return json({ 
    shop: session.shop,
    products,
  });
};

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "create_product") {
    const productData = formData.get("productData");
    
    if (!productData) {
      return json<ActionData>({ error: "No product data provided" }, { status: 400 });
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
        return json<ActionData>({ error: "Product is already enabled for AI generation" }, { status: 400 });
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

      return json<ActionData>({ success: true, message: "Product enabled for AI generation" });
    } catch (error) {
      console.error("Error creating product:", error);
      return json<ActionData>({ error: "Failed to enable product for AI generation" }, { status: 500 });
    }
  }

  return json<ActionData>({ error: "Invalid action" }, { status: 400 });
};

export default function ProductsIndexPage() {
  const { shop, products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const redirect = await (window as any).shopify.actions.Redirect.create({
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
    <>
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
                  <InlineStack gap="200">
                    <Button onClick={handleProductSelection} variant="primary">
                      Select from Store
                    </Button>
                  </InlineStack>
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
                              Select Existing Product
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Choose from products already in your store to enable for AI pet generation.
                            </Text>
                          </BlockStack>
                          <Button 
                            variant="primary" 
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
                            variant="secondary" 
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
                  </Layout>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>{productsMarkup}</Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </>
  );
} 