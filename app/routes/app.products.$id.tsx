import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useRevalidator, useActionData } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import { boundary } from "@shopify/shopify-app-remix/server";
import drizzleDb from "~/db.server";
import {
  productsTable,
  aiStylesTable,
  productStylesTable,
  productBasesTable,
  productProductBasesTable,
  productBaseVariantsTable,
  productBaseVariantMappingsTable,
  productBaseOptionsTable,
  productBaseVariantOptionValuesTable,
} from "~/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getShopId } from "~/utils/getShopId";
import { extractShopifyId } from "~/utils/shopHelpers";
import { useState, useCallback, useEffect, useRef } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useProductFormStore } from "~/stores/productFormStore";
import { ProductDetailPage } from "~/components/ProductDetailPage";
import { createActionRouter } from "~/utils/createActionRouter";
import { withZodHandler } from "~/utils/withZodHandler";
import { AI_METAFIELD_NAMESPACE, AI_METAFIELD_KEYS } from "~/constants";
import {
  ProductSettingsSchema,
  VariantPriceUpdateSchema,
  VariantDeletionSchema,
  VariantCreationActionSchema,
} from "~/schemas/product";

// Simplified GraphQL query - only fetch essential product data
const PRODUCT_QUERY = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      variants(first: 100) {
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
      images(first: 10) {
        edges {
          node {
            id
            url
            altText
          }
        }
      }
    }
  }
`;

// Optimized loader with minimal queries
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { id } = params;

  if (!id) {
    throw new Response("Product ID is required", { status: 400 });
  }

  const shopId = getShopId(session.shop);

  // Single query to get product with basic info
  const dbProduct = await drizzleDb
    .select()
    .from(productsTable)
    .where(eq(productsTable.uuid, id))
    .limit(1);

  if (dbProduct.length === 0) {
    throw new Response("Product not found", { status: 404 });
  }

  const product = dbProduct[0];

  // Fetch Shopify product data
  let shopifyProduct = null;
  try {
    const response = await admin.graphql(PRODUCT_QUERY, {
      variables: { id: `gid://shopify/Product/${product.shopifyProductId}` }
    });
    const data = await response.json();

    if (data.data?.product) {
      shopifyProduct = data.data.product;

      // Update title if changed
      if (shopifyProduct.title !== product.title) {
        await drizzleDb
          .update(productsTable)
          .set({
            title: shopifyProduct.title,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(productsTable.uuid, id));
      }
    }
  } catch (error) {
    console.error("Error fetching Shopify product:", error);
  }

  // Create fallback if needed
  if (!shopifyProduct) {
    shopifyProduct = {
      id: `gid://shopify/Product/${product.shopifyProductId}`,
      title: product.title,
      handle: product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      status: "ACTIVE",
      variants: { edges: [] },
      images: { edges: [] }
    };
  }

  // Parallel queries for all related data
  const [
    aiStyles,
    productStyles,
    productBases,
    productProductBases,
    productBaseVariants,
    productBaseOptions,
    productBaseVariantOptionValues,
    variantMappings
  ] = await Promise.all([
    // AI Styles for this shop
    drizzleDb
      .select()
      .from(aiStylesTable)
      .where(eq(aiStylesTable.shopId, shopId)),

    // Product-Style relationships
    drizzleDb
      .select({
        id: productStylesTable.id,
        aiStyleId: productStylesTable.aiStyleId,
        sortOrder: productStylesTable.sortOrder,
        isEnabled: productStylesTable.isEnabled,
        aiStyle: {
          id: aiStylesTable.id,
          uuid: aiStylesTable.uuid,
          name: aiStylesTable.name,
          exampleImageUrl: aiStylesTable.exampleImageUrl,
          isActive: aiStylesTable.isActive,
        }
      })
      .from(productStylesTable)
      .leftJoin(aiStylesTable, eq(productStylesTable.aiStyleId, aiStylesTable.id))
      .where(eq(productStylesTable.productId, product.id))
      .orderBy(productStylesTable.sortOrder),

    // Product Bases for this shop
    drizzleDb
      .select()
      .from(productBasesTable)
      .where(eq(productBasesTable.shopId, shopId))
      .orderBy(productBasesTable.sortOrder, productBasesTable.name),

    // Product-Product Base relationships
    drizzleDb
      .select({
        id: productProductBasesTable.id,
        productBaseId: productProductBasesTable.productBaseId,
        isEnabled: productProductBasesTable.isEnabled,
        sortOrder: productProductBasesTable.sortOrder,
        productBase: {
          id: productBasesTable.id,
          uuid: productBasesTable.uuid,
          name: productBasesTable.name,
        },
      })
      .from(productProductBasesTable)
      .leftJoin(productBasesTable, eq(productProductBasesTable.productBaseId, productBasesTable.id))
      .where(eq(productProductBasesTable.productId, product.id))
      .orderBy(productProductBasesTable.sortOrder),

    // Product Base Variants (fetch all for enabled product bases)
    drizzleDb
      .select({
        id: productBaseVariantsTable.id,
        uuid: productBaseVariantsTable.uuid,
        productBaseId: productBaseVariantsTable.productBaseId,
        name: productBaseVariantsTable.name,
        widthPx: productBaseVariantsTable.widthPx,
        heightPx: productBaseVariantsTable.heightPx,
        priceModifier: productBaseVariantsTable.price,
        isActive: productBaseVariantsTable.isActive,
        sortOrder: productBaseVariantsTable.sortOrder,
        productBase: {
          id: productBasesTable.id,
          uuid: productBasesTable.uuid,
          name: productBasesTable.name,
        }
      })
      .from(productBaseVariantsTable)
      .leftJoin(productBasesTable, eq(productBaseVariantsTable.productBaseId, productBasesTable.id))
      .where(eq(productBasesTable.shopId, shopId))
      .orderBy(productBaseVariantsTable.productBaseId, productBaseVariantsTable.sortOrder),

    // Product Base Options
    drizzleDb
      .select({
        id: productBaseOptionsTable.id,
        productBaseId: productBaseOptionsTable.productBaseId,
        name: productBaseOptionsTable.name,
        sortOrder: productBaseOptionsTable.sortOrder,
      })
      .from(productBaseOptionsTable)
      .leftJoin(productBasesTable, eq(productBaseOptionsTable.productBaseId, productBasesTable.id))
      .where(eq(productBasesTable.shopId, shopId))
      .orderBy(productBaseOptionsTable.productBaseId, productBaseOptionsTable.sortOrder),

    // Product Base Variant Option Values
    drizzleDb
      .select({
        id: productBaseVariantOptionValuesTable.id,
        productBaseVariantId: productBaseVariantOptionValuesTable.productBaseVariantId,
        productBaseOptionId: productBaseVariantOptionValuesTable.productBaseOptionId,
        value: productBaseVariantOptionValuesTable.value,
      })
      .from(productBaseVariantOptionValuesTable),

    // Variant Mappings
    drizzleDb
      .select({
        id: productBaseVariantMappingsTable.id,
        productBaseVariantId: productBaseVariantMappingsTable.productBaseVariantId,
        shopifyVariantId: productBaseVariantMappingsTable.shopifyVariantId,
        isActive: productBaseVariantMappingsTable.isActive,
        productBaseVariant: {
          id: productBaseVariantsTable.id,
          uuid: productBaseVariantsTable.uuid,
          name: productBaseVariantsTable.name,
        }
      })
      .from(productBaseVariantMappingsTable)
      .leftJoin(productBaseVariantsTable, eq(productBaseVariantMappingsTable.productBaseVariantId, productBaseVariantsTable.id))
      .where(eq(productBaseVariantMappingsTable.productId, product.id))
  ]);

  // Process selected styles
  const selectedStyles = productStyles
    .filter(ps => ps.isEnabled)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(ps => ps.aiStyle?.uuid || '')
    .filter(uuid => uuid);

  // Process linked product bases
  const linkedProductBases = productProductBases
    .filter(ppb => ppb.isEnabled)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(ppb => ppb.productBase?.uuid || '')
    .filter(uuid => uuid);

  return Response.json({
    product: {
      ...product,
      title: shopifyProduct?.title || product.title,
    },
    shopifyProduct,
    aiStyles,
    productStyles,
    selectedStyles,
    productBases,
    productProductBases,
    linkedProductBases,
    productBaseVariants,
    productBaseOptions,
    productBaseVariantOptionValues,
    variantMappings,
    shop: session.shop,
    updateNeeded: false,
  });
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

// Action handlers using the new pattern
const saveProductSettings = withZodHandler(
  ProductSettingsSchema,
  async ({ params }, input, session, admin) => {
    const { id } = params;
    if (!id) throw new Error("Product ID is required");

    const shopId = getShopId(session.shop);
    const currentTime = new Date().toISOString();

    // Get product
    const dbProduct = await drizzleDb
      .select()
      .from(productsTable)
      .where(eq(productsTable.uuid, id))
      .limit(1);

    if (dbProduct.length === 0) {
      throw new Error("Product not found");
    }

    const product = dbProduct[0];
    const productId = product.id;

    // Update product enabled status
    await drizzleDb
      .update(productsTable)
      .set({
        isEnabled: input.isEnabled,
        updatedAt: currentTime,
      })
      .where(eq(productsTable.uuid, id));

    // Handle AI styles
    const aiStyles = await drizzleDb
      .select()
      .from(aiStylesTable)
      .where(eq(aiStylesTable.shopId, shopId));

    const styleUuidToId = new Map(aiStyles.map(style => [style.uuid, style.id]));

    // Delete existing product-style relationships
    await drizzleDb
      .delete(productStylesTable)
      .where(eq(productStylesTable.productId, productId));

    // Insert new style relationships
    if (input.selectedStyles.length > 0) {
      const productStylesToInsert = input.selectedStyles.map((styleUuid, index) => {
        const styleId = styleUuidToId.get(styleUuid);
        if (!styleId) throw new Error(`Style not found: ${styleUuid}`);

        const reorderedStyle = input.reorderedStyles.find(rs => rs.uuid === styleUuid);
        const sortOrder = reorderedStyle ? reorderedStyle.sortOrder : index;

        return {
          productId,
          aiStyleId: styleId,
          sortOrder,
          isEnabled: true,
          createdAt: currentTime,
          updatedAt: currentTime,
        };
      });

      await drizzleDb
        .insert(productStylesTable)
        .values(productStylesToInsert);
    }

    // Handle product bases
    const productBases = await drizzleDb
      .select()
      .from(productBasesTable)
      .where(eq(productBasesTable.shopId, shopId));

    const productBaseUuidToId = new Map(productBases.map(pb => [pb.uuid, pb.id]));

    // Delete existing product-product base relationships
    await drizzleDb
      .delete(productProductBasesTable)
      .where(eq(productProductBasesTable.productId, productId));

    // Insert new product base relationships
    if (input.selectedProductBases.length > 0) {
      const productProductBasesToInsert = input.selectedProductBases.map((productBaseUuid, index) => {
        const productBaseId = productBaseUuidToId.get(productBaseUuid);
        if (!productBaseId) throw new Error(`Product base not found: ${productBaseUuid}`);

        return {
          productId,
          productBaseId,
          sortOrder: index,
          isEnabled: true,
          createdAt: currentTime,
          updatedAt: currentTime,
        };
      });

      await drizzleDb
        .insert(productProductBasesTable)
        .values(productProductBasesToInsert);
    }

    // Handle variant mappings
    await drizzleDb
      .delete(productBaseVariantMappingsTable)
      .where(eq(productBaseVariantMappingsTable.productId, productId));

    if (input.variantMappings.length > 0) {
      const mappingsToInsert = input.variantMappings.map(mapping => ({
        productId,
        productBaseVariantId: mapping.productBaseVariantId,
        shopifyVariantId: extractShopifyId(mapping.shopifyVariantId),
        isActive: true,
        createdAt: currentTime,
        updatedAt: currentTime,
      }));

      await drizzleDb
        .insert(productBaseVariantMappingsTable)
        .values(mappingsToInsert);
    }

    // Update Shopify metafields
    const shopifyGID = `gid://shopify/Product/${product.shopifyProductId}`;
    try {
      await admin.graphql(
        `mutation UpdateProductMetafields($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            input: {
              id: shopifyGID,
              metafields: [
                {
                  namespace: AI_METAFIELD_NAMESPACE,
                  key: AI_METAFIELD_KEYS.AI_ENABLED,
                  value: input.isEnabled.toString(),
                  type: "boolean"
                },
                {
                  namespace: AI_METAFIELD_NAMESPACE,
                  key: AI_METAFIELD_KEYS.LAST_UPDATED,
                  value: currentTime,
                  type: "date_time"
                }
              ]
            }
          }
        }
      );
    } catch (error) {
      console.error("Error updating metafields:", error);
    }

    return Response.json({
      success: true,
      message: `Product ${input.isEnabled ? 'enabled' : 'disabled'} for AI generation with ${input.selectedStyles.length} style(s), ${input.selectedProductBases.length} product base(s), and ${input.variantMappings.length} variant mapping(s) saved`
    });
  }
);

const updateVariantPrice = withZodHandler(
  VariantPriceUpdateSchema,
  async ({ params }, input, session, admin) => {
    const { id } = params;
    if (!id) throw new Error("Product ID is required");

    const dbProduct = await drizzleDb
      .select()
      .from(productsTable)
      .where(eq(productsTable.uuid, id))
      .limit(1);

    if (dbProduct.length === 0) {
      throw new Error("Product not found");
    }

    const shopifyGID = `gid://shopify/Product/${dbProduct[0].shopifyProductId}`;

    const response = await admin.graphql(
      `mutation UpdateProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants, allowPartialUpdates: true) {
          product { id }
          productVariants { id price }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          productId: shopifyGID,
          variants: [{
            id: input.variantId,
            price: input.newPrice
          }]
        }
      }
    );

    const data = await response.json();

    if (data.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
      throw new Error(`Failed to update variant price: ${data.data.productVariantsBulkUpdate.userErrors.map((e: any) => e.message).join(', ')}`);
    }

    return Response.json({
      success: true,
      message: "Variant price updated successfully"
    });
  }
);

const deleteVariant = withZodHandler(
  VariantDeletionSchema,
  async ({ params }, input, session, admin) => {
    const { id } = params;
    if (!id) throw new Error("Product ID is required");

    const dbProduct = await drizzleDb
      .select()
      .from(productsTable)
      .where(eq(productsTable.uuid, id))
      .limit(1);

    if (dbProduct.length === 0) {
      throw new Error("Product not found");
    }

    const shopifyGID = `gid://shopify/Product/${dbProduct[0].shopifyProductId}`;

    const response = await admin.graphql(
      `mutation DeleteProductVariants($productId: ID!, $variantsIds: [ID!]!) {
        productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
          product { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          productId: shopifyGID,
          variantsIds: [input.variantId]
        }
      }
    );

    const data = await response.json();

    if (data.data?.productVariantsBulkDelete?.userErrors?.length > 0) {
      throw new Error(`Failed to delete variant: ${data.data.productVariantsBulkDelete.userErrors.map((e: any) => e.message).join(', ')}`);
    }

    // Remove variant mappings
    const numericVariantId = extractShopifyId(input.variantId);
    await drizzleDb
      .delete(productBaseVariantMappingsTable)
      .where(eq(productBaseVariantMappingsTable.shopifyVariantId, numericVariantId));

    return Response.json({
      success: true,
      message: "Variant deleted successfully"
    });
  }
);

const createVariants = withZodHandler(
  VariantCreationActionSchema,
  async ({ params }, input, session, admin) => {
    const { id } = params;
    if (!id) throw new Error("Product ID is required");

    const dbProduct = await drizzleDb
      .select()
      .from(productsTable)
      .where(eq(productsTable.uuid, id))
      .limit(1);

    if (dbProduct.length === 0) {
      throw new Error("Product not found");
    }

    const shopifyGID = `gid://shopify/Product/${dbProduct[0].shopifyProductId}`;

    const variantInputs = input.variantsToCreate.map(variant => ({
      optionValues: variant.options.map(opt => ({
        optionName: opt.name,
        name: opt.value
      })),
      price: "0.00",
      inventoryItem: {
        tracked: false
      }
    }));

    const response = await admin.graphql(
      `mutation CreateProductVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          product { id }
          productVariants { id title }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          productId: shopifyGID,
          variants: variantInputs
        }
      }
    );

    const data = await response.json();

    if (data.data?.productVariantsBulkCreate?.userErrors?.length > 0) {
      const errors = data.data.productVariantsBulkCreate.userErrors;
      throw new Error(`Failed to create variants: ${errors.map((e: any) => e.message).join(', ')}`);
    }

    return Response.json({
      success: true,
      message: `Successfully created ${input.variantsToCreate.length} new variant(s)`
    });
  }
);

// Create action router
export const action = async (args: any) => {
  console.log('=== ROUTE ACTION CALLED ===');
  console.log('Request method:', args.request.method);
  console.log('Request URL:', args.request.url);
  console.log('Request headers:', Object.fromEntries(args.request.headers.entries()));

  try {
    const clonedRequest = args.request.clone();
    const body = await clonedRequest.text();
    console.log('Raw request body:', body);
    console.log('Body length:', body.length);
  } catch (e) {
    console.log('Could not read request body:', e);
  }

  const router = createActionRouter({
    save_product_settings: saveProductSettings,
    update_variant_price: updateVariantPrice,
    delete_variant: deleteVariant,
    create_variants: createVariants,
  });

  return router(args);
};

// Component
export default function ProductDetailPageNew() {
  const loaderData = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const actionData = useActionData<typeof action>();
  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Simple submit handler - just pass data to the store, let it handle submission
  const handleSubmit = useCallback((data: FormData | Record<string, unknown>) => {
    // The store will handle the actual submission
    if (typeof data === 'object' && '_action' in data) {
      // This is already structured data from the store, trigger a form submission
      const form = document.createElement('form');
      form.method = 'POST';
      form.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'data';
      input.value = JSON.stringify(data);
      form.appendChild(input);

      document.body.appendChild(form);
      form.submit();
    }
  }, []);

  // Initialize store
  useEffect(() => {
    if (!useProductFormStore.getState().preventStateReset) {
      useProductFormStore.getState().initialize({
        product: loaderData.product,
        isEnabled: loaderData.product.isEnabled,
        selectedStyles: loaderData.selectedStyles,
        selectedProductBases: loaderData.linkedProductBases,
        variantMappings: loaderData.variantMappings,
        shopifyProduct: loaderData.shopifyProduct,
        aiStyles: loaderData.aiStyles,
        productBases: loaderData.productBases,
        productBaseVariants: loaderData.productBaseVariants,
        productBaseOptions: loaderData.productBaseOptions,
        productBaseVariantOptionValues: loaderData.productBaseVariantOptionValues,
        shop: loaderData.shop,
        updateNeeded: loaderData.updateNeeded,
      });
    }
  }, [loaderData]);

  return (
    <ProductDetailPage
      shopify={shopify}
      navigate={navigate}
      actionData={actionData}
      revalidator={revalidator}
      handleSubmit={handleSubmit}
    />
  );
}
