import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useActionData, Link } from "@remix-run/react";
import {
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  InlineStack,
  Badge,
  Thumbnail,
  IndexTable,
  Checkbox,
  Banner,
  TextField,
} from "@shopify/polaris";
import { ArrowLeftIcon, ImageIcon } from "@shopify/polaris-icons";
import { TitleBar, SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import drizzleDb from "../db.server";
import { productsTable, sizesTable, aiStylesTable, type Product, type Size, type AiStyle } from "../db/schema";
import { eq } from "drizzle-orm";
import { getShopId } from "../utils/getShopId";
import { useState, useCallback, useEffect } from "react";
import BreadcrumbLink from "../components/BreadcrumbLink";
import { METAFIELDS } from "../constants";

// GraphQL query to fetch product with variants and metafields
const PRODUCT_QUERY = `
  query Product($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      createdAt
      updatedAt
      productType
      vendor
      descriptionHtml
      metafields(first: 250) {
        edges {
          node {
            id
            namespace
            key
            value
            type
            description
            createdAt
            updatedAt
          }
        }
      }
      images(first: 5) {
        edges {
          node {
            id
            url
            altText
          }
        }
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            sku
            price
            compareAtPrice
            availableForSale
            inventoryQuantity
            position
            selectedOptions {
              name
              value
            }
            image {
              id
              url
              altText
            }
          }
        }
      }
    }
  }
`;

// GraphQL mutation to update product metafields
const UPDATE_PRODUCT_METAFIELDS_MUTATION = `
  mutation UpdateProductMetafields($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface ShopifyMetafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice?: string;
  availableForSale: boolean;
  inventoryQuantity: number;
  position: number;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
  image?: {
    id: string;
    url: string;
    altText?: string;
  };
}

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  productType: string;
  vendor: string;
  descriptionHtml: string;
  metafields: {
    edges: Array<{
      node: ShopifyMetafield;
    }>;
  };
  images: {
    edges: Array<{
      node: {
        id: string;
        url: string;
        altText?: string;
      };
    }>;
  };
  variants: {
    edges: Array<{
      node: ShopifyVariant;
    }>;
  };
}

type ActionData =
  | { error: string; success?: undefined; message?: undefined }
  | { success: true; message: string; error?: undefined };

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("Product ID is required", { status: 400 });
  }

  // Fetch the product from our database
  const dbProduct = await drizzleDb
    .select()
    .from(productsTable)
    .where(eq(productsTable.uuid, id))
    .limit(1);

  if (dbProduct.length === 0) {
    throw new Response("Product not found", { status: 404 });
  }

  const product = dbProduct[0];

  // Fetch the product from Shopify with variants
  const shopifyGID = `gid://shopify/Product/${product.shopifyProductId}`;

  let shopifyProduct: ShopifyProduct | null = null;
  let updateNeeded = false;

  try {
    const response = await admin.graphql(PRODUCT_QUERY, {
      variables: { id: shopifyGID }
    });

    const data = await response.json();

    if (data.data?.product) {
      const fetchedProduct = data.data.product;
      shopifyProduct = fetchedProduct;

      // Log all metafields for the product
      const productMetafields = fetchedProduct.metafields?.edges?.map((edge: { node: ShopifyMetafield }) => edge.node) || [];
      console.log('=== PRODUCT METAFIELDS ===');
      console.log(`Product: ${fetchedProduct.title} (ID: ${fetchedProduct.id})`);
      console.log(`Total metafields: ${productMetafields.length}`);
      
      if (productMetafields.length > 0) {
        productMetafields.forEach((metafield: ShopifyMetafield, index: number) => {
          console.log(`\n--- Product Metafield ${index + 1} ---`);
          console.log(`Namespace: ${metafield.namespace}`);
          console.log(`Key: ${metafield.key}`);
          console.log(`Type: ${metafield.type}`);
          console.log(`Value: ${metafield.value}`);
          console.log(`Description: ${metafield.description || 'N/A'}`);
          console.log(`Created: ${metafield.createdAt}`);
          console.log(`Updated: ${metafield.updatedAt}`);
        });
      } else {
        console.log('No metafields found for this product.');
      }

      // Check if title needs updating
      if (fetchedProduct.title !== product.title) {
        updateNeeded = true;

        // Update the title in our database
        await drizzleDb
          .update(productsTable)
          .set({
            title: fetchedProduct.title,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(productsTable.uuid, id));
      }
    }
  } catch (error) {
    console.error("Error fetching product from Shopify:", error);
  }

  // Fetch sizes for this product
  const sizes = await drizzleDb
    .select()
    .from(sizesTable)
    .where(eq(sizesTable.productId, product.id));

  // Fetch available AI styles for this shop
  const shopId = getShopId(session.shop);
  const aiStyles = await drizzleDb
    .select()
    .from(aiStylesTable)
    .where(eq(aiStylesTable.shopId, shopId));

  return json({
    product: {
      ...product,
      title: shopifyProduct?.title || product.title, // Use updated title
    },
    shopifyProduct,
    sizes,
    aiStyles,
    shop: session.shop,
    updateNeeded,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    return json<ActionData>({ error: "Product ID is required" }, { status: 400 });
  }

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "toggle_enabled") {
    const isEnabled = formData.get("isEnabled") === "true";

    try {
      // Update our database
      await drizzleDb
        .update(productsTable)
        .set({
          isEnabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(productsTable.uuid, id));

      // Get the product from our database to get the Shopify product ID
      const dbProduct = await drizzleDb
        .select()
        .from(productsTable)
        .where(eq(productsTable.uuid, id))
        .limit(1);

      if (dbProduct.length > 0) {
        const shopifyGID = `gid://shopify/Product/${dbProduct[0].shopifyProductId}`;
        const currentDate = new Date().toISOString();

        // Update metafields on the Shopify product
        const metafieldsInput = {
          id: shopifyGID,
          metafields: [
            {
              namespace: METAFIELDS.NAMESPACE,
              key: METAFIELDS.KEYS.AI_ENABLED,
              value: isEnabled.toString(),
              type: "boolean"
            },
            {
              namespace: METAFIELDS.NAMESPACE, 
              key: METAFIELDS.KEYS.LAST_UPDATED,
              value: currentDate,
              type: "date_time"
            }
          ]
        };

        const metafieldResponse = await admin.graphql(UPDATE_PRODUCT_METAFIELDS_MUTATION, {
          variables: { input: metafieldsInput }
        });

        const metafieldData = await metafieldResponse.json();

        if (metafieldData.data?.productUpdate?.userErrors?.length > 0) {
          console.error("Error updating metafields:", metafieldData.data.productUpdate.userErrors);
        } else {
          console.log("Successfully updated product metafields");
        }
      }

      return json<ActionData>({
        success: true,
        message: `Product ${isEnabled ? 'enabled' : 'disabled'} for AI generation`
      });
    } catch (error) {
      console.error("Error updating product status:", error);
      return json<ActionData>({ error: "Failed to update product status" }, { status: 500 });
    }
  }

  return json<ActionData>({ error: "Invalid action" }, { status: 400 });
};

export default function ProductDetailPage() {
  const { product, shopifyProduct, sizes, aiStyles, shop, updateNeeded } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [isEnabled, setIsEnabled] = useState(product.isEnabled ?? false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const shopify = isClient ? useAppBridge() : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleBackClick = () => {
    navigate("/app/products");
  };

  const handleToggleEnabled = useCallback((checked: boolean) => {
    setIsEnabled(checked);
    setIsDirty(true);
  }, []);

  const handleStyleToggle = useCallback((styleId: string, checked: boolean) => {
    setSelectedStyles(prev => {
      if (checked) {
        return [...prev, styleId];
      } else {
        return prev.filter(id => id !== styleId);
      }
    });
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    const formData = new FormData();
    formData.append("action", "toggle_enabled");
    formData.append("isEnabled", isEnabled.toString());
    submit(formData, { method: "post" });
  }, [isEnabled, submit]);

  const handleDiscard = useCallback(() => {
    setIsEnabled(product.isEnabled ?? false);
    setIsDirty(false);
  }, [product.isEnabled]);

  // Show/hide save bar based on changes
  useEffect(() => {
    if (shopify) {
      if (isDirty && !isSaving) {
        shopify.saveBar.show('product-edit-save-bar');
      } else {
        shopify.saveBar.hide('product-edit-save-bar');
      }
    }
  }, [isDirty, isSaving, shopify]);

  // Handle successful save
  useEffect(() => {
    if (actionData && 'success' in actionData && actionData.success && isSaving) {
      setIsDirty(false);
      setIsSaving(false);
      if (shopify) {
        shopify.toast.show(actionData.message, { duration: 3000 });
      }
    } else if (actionData && 'error' in actionData && actionData.error && isSaving) {
      setIsSaving(false);
      // Show error toast if shopify is available
      if (shopify) {
        shopify.toast.show(actionData.error, { duration: 5000, isError: true });
      }
    }
  }, [actionData, isSaving, shopify]);

  const variants = shopifyProduct?.variants?.edges?.map(edge => edge.node) || [];

  const variantsMarkup = variants.length > 0 ? (
    <IndexTable
      resourceName={{ singular: 'variant', plural: 'variants' }}
      itemCount={variants.length}
      headings={[
        { title: 'Image' },
        { title: 'Title' },
        { title: 'Available' },
        { title: 'Print Area Size' },
      ]}
      selectable={false}
    >
      {variants.map((variant: ShopifyVariant, index: number) => (
        <IndexTable.Row id={variant.id} key={variant.id} position={index}>
          <IndexTable.Cell>
            <Thumbnail
              source={variant.image?.url || (shopifyProduct && shopifyProduct.images?.edges?.[0]?.node?.url) || ImageIcon}
              alt={variant.image?.altText || variant.title}
              size="small"
            />
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="semibold" as="span">
              {variant.title}
            </Text>
            {variant.selectedOptions.length > 0 && (
              <Text variant="bodySm" tone="subdued" as="p">
                {variant.selectedOptions.map(option => `${option.name}: ${option.value}`).join(', ')}
              </Text>
            )}
            <Text variant="bodySm" tone="subdued" as="p">
              SKU: {variant.sku || '-'}
            </Text>
            <Text variant="bodySm" tone="subdued" as="p">
              Price: {variant.price} {variant.compareAtPrice && (
                <Text variant="bodySm" tone="subdued" as="span">
                  Compare at: ${variant.compareAtPrice}
                </Text>
              )}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone={variant.availableForSale ? "success" : "critical"}>
              {variant.availableForSale ? "Available" : "Unavailable"}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack wrap={false} gap="100" align="center" blockAlign="center">
              <TextField
                label="Print Area Width"
                autoComplete="off"
                labelHidden
              />
              <Text variant="bodyMd" as="span">&times;</Text>
              <TextField
                label="Print Area Height"
                autoComplete="off"
                labelHidden
              />
              px
            </InlineStack>
          </IndexTable.Cell>
        </IndexTable.Row>
      ))}
    </IndexTable>
  ) : (
    <Text variant="bodyMd" tone="subdued" as="p">
      No variants found for this product.
    </Text>
  );

  return (
    <>
      <TitleBar title={`Product: ${product.title}`}      >
        <BreadcrumbLink
          to="/app/products"
        >
          Products
        </BreadcrumbLink>
      </TitleBar>

      <BlockStack gap="500">
        {updateNeeded && (
          <Banner tone="info">
            Product title was automatically updated from Shopify to keep data in sync.
          </Banner>
        )}

        {actionData && 'error' in actionData && (
          <Banner tone="critical">
            {actionData.error}
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Button
                variant="tertiary"
                onClick={handleBackClick}
                icon={ArrowLeftIcon}
              >
                Back to Products
              </Button>

              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="400" align="start">
                    <Thumbnail
                      source={shopifyProduct?.images?.edges?.[0]?.node?.url || ImageIcon}
                      alt={product.title}
                      size="large"
                    />
                    <BlockStack gap="300">
                      <Text as="h1" variant="headingLg">
                        {product.title}
                      </Text>

                      <InlineStack gap="300">
                        <Badge tone={isEnabled ? "success" : "attention"}>
                          {isEnabled ? "AI Enabled" : "AI Disabled"}
                        </Badge>
                        {shopifyProduct?.status && (
                          <Badge tone={shopifyProduct.status === 'ACTIVE' ? "success" : "attention"}>
                            {shopifyProduct.status}
                          </Badge>
                        )}
                      </InlineStack>

                      <Checkbox
                        label="Enable for AI Generation"
                        checked={isEnabled}
                        onChange={handleToggleEnabled}
                        helpText="When enabled, customers can generate AI art for this product."
                      />

                                             <BlockStack gap="200">
                         <Text variant="bodyMd" as="dt" fontWeight="semibold">
                           Shopify Product ID
                         </Text>
                         <Text variant="bodyMd" as="dd">
                           {product.shopifyProductId}
                         </Text>
                       </BlockStack>

                       <InlineStack gap="300">
                         {shopifyProduct && (
                           <Button 
                             variant="secondary"
                             size="slim"
                             url={`https://${shop}/products/${shopifyProduct.handle}`}
                             target="_blank"
                           >
                             View in Shop
                           </Button>
                         )}
                         {shopifyProduct && (
                           <Button 
                             variant="secondary"
                             size="slim"
                             url={`https://${shop}/admin/products/${product.shopifyProductId}`}
                             target="_blank"
                           >
                             Edit in Shopify
                           </Button>
                         )}
                       </InlineStack>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    AI Styles Selection
                  </Text>

                  {aiStyles.length > 0 ? (
                    <BlockStack gap="400">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Select which AI styles are available for this product. Customers will be able to choose from the selected styles when generating images.
                      </Text>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: '16px'
                      }}>
                        {aiStyles.map((style: AiStyle) => {
                          const isSelected = selectedStyles.includes(style.uuid);
                          return (
                            <div
                              key={style.id}
                              onClick={() => handleStyleToggle(style.uuid, !isSelected)}
                              style={{
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                              }}
                            >
                              <div style={{ position: 'relative' }}>
                                <Card
                                  background={isSelected ? "bg-surface-selected" : "bg-surface-secondary"}
                                  padding="300"
                                >
                                  <InlineStack gap="300" align="start" blockAlign="center">
                                    {style.exampleImageUrl && (
                                      <div style={{ flexShrink: 0 }}>
                                        <Thumbnail
                                          source={style.exampleImageUrl}
                                          alt={style.name}
                                          size="small"
                                        />
                                      </div>
                                    )}
                                    <BlockStack gap="100">
                                      <Text variant="bodyMd" fontWeight="semibold" as="span">
                                        {style.name}
                                      </Text>
                                      <div style={{ alignSelf: 'flex-start' }}>
                                        <Badge
                                          tone={style.isActive ? "success" : "critical"}
                                          size="small"
                                        >
                                          {style.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                      </div>
                                    </BlockStack>
                                  </InlineStack>
                                </Card>
                                <div style={{
                                  position: 'absolute',
                                  top: '12px',
                                  right: '12px',
                                  zIndex: 1
                                }}>
                                  <Checkbox
                                    label={`Enable ${style.name} for this product`}
                                    labelHidden
                                    checked={isSelected}
                                    onChange={(checked) => handleStyleToggle(style.uuid, checked)}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <InlineStack gap="200" align="space-between">
                        <Text variant="bodySm" tone="subdued" as="span">
                          {selectedStyles.length} of {aiStyles.length} styles selected
                        </Text>
                        {selectedStyles.length > 0 && (
                          <Button
                            variant="plain"
                            size="slim"
                            onClick={() => setSelectedStyles([])}
                          >
                            Clear all
                          </Button>
                        )}
                      </InlineStack>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="300">
                      <Text variant="bodyMd" tone="subdued" as="p">
                        No AI styles have been created yet.
                      </Text>
                      <Button variant="primary" url="/app/styles">
                        Create AI Styles
                      </Button>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Product Variants ({variants.length})
                  </Text>
                  {variantsMarkup}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Available Sizes for AI Generation
                  </Text>

                  {sizes.length > 0 ? (
                    <BlockStack gap="300">
                      {sizes.map((size: Size) => (
                        <Card key={size.id} background="bg-surface-secondary">
                          <InlineStack gap="400" align="space-between">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="semibold" as="span">
                                {size.name}
                              </Text>
                              <Text variant="bodySm" tone="subdued" as="span">
                                {size.widthPx} × {size.heightPx} pixels
                              </Text>
                            </BlockStack>
                            <Badge tone={size.isActive ? "success" : "critical"}>
                              {size.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </InlineStack>
                        </Card>
                      ))}
                    </BlockStack>
                  ) : (
                    <Text variant="bodyMd" tone="subdued" as="p">
                      No sizes configured for this product yet. Add sizes to allow customers to select different image dimensions.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Quick Actions
                  </Text>

                                    <InlineStack gap="300">
                    <Button variant="secondary">
                      Manage Sizes
                    </Button>
                    <Button variant="secondary">
                      View Analytics
                    </Button>
                    <Button variant="secondary">
                      Configure AI Styles
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Native Shopify SaveBar */}
      <SaveBar id="product-edit-save-bar">
        <button
          variant="primary"
          onClick={handleSave}
          loading={isSaving ? "" : undefined}
          disabled={isSaving}
        >
          Save Changes
        </button>
        <button
          onClick={handleDiscard}
          disabled={isSaving}
        >
          Discard
        </button>
      </SaveBar>
    </>
  );
} 