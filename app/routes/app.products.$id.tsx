import type {LoaderFunctionArgs, ActionFunctionArgs} from "@remix-run/node";
import {useLoaderData, useNavigate, useSubmit, useActionData, useRevalidator} from "@remix-run/react";
import {
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
  Thumbnail,
  Page,
  Banner,
  Checkbox,
  Button,
  IndexTable,
} from "@shopify/polaris";
import {ImageIcon} from "@shopify/polaris-icons";
import {TitleBar, SaveBar, useAppBridge} from "@shopify/app-bridge-react";
import {authenticate} from "~/shopify.server";
import drizzleDb from "../db.server";
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
import {eq, inArray} from "drizzle-orm";
import {getShopId} from "~/utils/getShopId";
import {extractShopifyId} from "~/utils/shopHelpers";
import {useState, useCallback, useEffect} from "react";
import BreadcrumbLink from "../components/BreadcrumbLink";
import {AiStyleSelection} from "~/components/AiStyleSelection";
import {ProductFormProvider, useProductForm} from "~/contexts/ProductFormContext";

// Import GraphQL queries from the original file
// GraphQL query to fetch product with variants, handle, status, and images
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

// Type definitions for action data
type ActionData =
  | { error: string; success?: undefined; message?: undefined }
  | { success: true; message: string; error?: undefined };

// Loader function - similar to the original but adapted for the context
export const loader = async ({request, params}: LoaderFunctionArgs) => {
  const {session, admin} = await authenticate.admin(request);
  const {id} = params;

  if (!id) {
    throw new Response("Product ID is required", {status: 400});
  }

  // Fetch the product from our database
  const dbProduct = await drizzleDb
    .select()
    .from(productsTable)
    .where(eq(productsTable.uuid, id))
    .limit(1);

  if (dbProduct.length === 0) {
    throw new Response("Product not found", {status: 404});
  }

  const product = dbProduct[0];

  // Fetch the product from Shopify with variants
  const shopifyGID = `gid://shopify/Product/${product.shopifyProductId}`;

  let shopifyProduct = null;
  let updateNeeded = false;

  try {
    const response = await admin.graphql(PRODUCT_QUERY, {
      variables: {id: shopifyGID}
    });

    const data = await response.json();

    if (data.errors) {
      console.error("GraphQL errors fetching product:", data.errors);
      // Continue with the flow, using fallback data
    } else if (data.data?.product) {
      const fetchedProduct = data.data.product;
      shopifyProduct = fetchedProduct;

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
    } else {
      console.warn("No product data returned from Shopify for ID:", shopifyGID);
    }
  } catch (error) {
    console.error("Error fetching product from Shopify:", error);
    // Continue with the flow, using fallback data
  }

  // Create a fallback shopifyProduct if none was fetched
  if (!shopifyProduct) {
    console.warn("Using fallback shopifyProduct data for:", product.title);
    shopifyProduct = {
      id: shopifyGID,
      title: product.title,
      handle: product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      status: "ACTIVE",
      variants: {edges: []},
      images: {edges: []}
    };
  }

  // Fetch available AI styles for this shop
  const shopId = getShopId(session.shop);
  const aiStyles = await drizzleDb
    .select()
    .from(aiStylesTable)
    .where(eq(aiStylesTable.shopId, shopId));

  // Fetch product-style relationships from database
  const productStyles = await drizzleDb
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
    .orderBy(productStylesTable.sortOrder);

  // Extract selected styles (enabled ones) with ordering
  const selectedStyles = productStyles
    .filter(ps => ps.isEnabled)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(ps => ps.aiStyle?.uuid || '')
    .filter(uuid => uuid);

  // Fetch available product bases for this shop
  const productBases = await drizzleDb
    .select()
    .from(productBasesTable)
    .where(eq(productBasesTable.shopId, shopId))
    .orderBy(productBasesTable.sortOrder, productBasesTable.name);

  // Fetch existing product-product base relationships
  const productProductBases = await drizzleDb
    .select({
      id: productProductBasesTable.id,
      productBaseId: productProductBasesTable.productBaseId,
      isEnabled: productProductBasesTable.isEnabled,
      sortOrder: productProductBasesTable.sortOrder,
      productBase: {
        id: productBasesTable.id,
        uuid: productBasesTable.uuid,
        name: productBasesTable.name,
        isActive: productBasesTable.isActive,
      }
    })
    .from(productProductBasesTable)
    .leftJoin(productBasesTable, eq(productProductBasesTable.productBaseId, productBasesTable.id))
    .where(eq(productProductBasesTable.productId, product.id))
    .orderBy(productProductBasesTable.sortOrder);

  // Extract linked product base UUIDs
  const linkedProductBases = productProductBases
    .filter(ppb => ppb.isEnabled)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(ppb => ppb.productBase?.uuid || '')
    .filter(uuid => uuid);

  // Fetch product base variants for linked product bases
  const productBaseVariants = linkedProductBases.length > 0 ? await drizzleDb
    .select({
      id: productBaseVariantsTable.id,
      uuid: productBaseVariantsTable.uuid,
      productBaseId: productBaseVariantsTable.productBaseId,
      name: productBaseVariantsTable.name,
      widthPx: productBaseVariantsTable.widthPx,
      heightPx: productBaseVariantsTable.heightPx,
      priceModifier: productBaseVariantsTable.priceModifier,
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
    .where(
      // Filter by shop ID
      eq(productBasesTable.shopId, shopId) &&
      // Only include variants for the linked product bases
      inArray(
        productBaseVariantsTable.productBaseId,
        productProductBases
          .filter(ppb => ppb.isEnabled)
          .map(ppb => ppb.productBaseId)
      )
    )
    .orderBy(productBaseVariantsTable.productBaseId, productBaseVariantsTable.sortOrder) : [];

  // Fetch product base options for linked product bases
  const productBaseOptions = linkedProductBases.length > 0 ? await drizzleDb
    .select({
      id: productBaseOptionsTable.id,
      productBaseId: productBaseOptionsTable.productBaseId,
      name: productBaseOptionsTable.name,
      sortOrder: productBaseOptionsTable.sortOrder,
    })
    .from(productBaseOptionsTable)
    .leftJoin(productBasesTable, eq(productBaseOptionsTable.productBaseId, productBasesTable.id))
    .where(
      // Filter by shop ID
      eq(productBasesTable.shopId, shopId) &&
      // Only include options for the linked product bases
      inArray(
        productBaseOptionsTable.productBaseId,
        productProductBases
          .filter(ppb => ppb.isEnabled)
          .map(ppb => ppb.productBaseId)
      )
    )
    .orderBy(productBaseOptionsTable.productBaseId, productBaseOptionsTable.sortOrder) : [];

  // Fetch option values for product base variants
  const productBaseVariantOptionValues = productBaseVariants.length > 0 ? await drizzleDb
    .select({
      id: productBaseVariantOptionValuesTable.id,
      productBaseVariantId: productBaseVariantOptionValuesTable.productBaseVariantId,
      productBaseOptionId: productBaseVariantOptionValuesTable.productBaseOptionId,
      value: productBaseVariantOptionValuesTable.value,
    })
    .from(productBaseVariantOptionValuesTable)
    .where(inArray(
      productBaseVariantOptionValuesTable.productBaseVariantId,
      productBaseVariants.map(variant => variant.id)
    )) : [];

  // Fetch existing variant mappings
  const variantMappings = await drizzleDb
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
    .where(eq(productBaseVariantMappingsTable.productId, product.id));

  return Response.json({
    product: {
      ...product,
      title: shopifyProduct?.title || product.title, // Use updated title
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
    updateNeeded,
  });
};

// Action function to handle form submissions
export const action = async ({request, params}: ActionFunctionArgs) => {
  const {session, admin} = await authenticate.admin(request);
  const {id} = params;

  if (!id) {
    return Response.json({error: "Product ID is required"}, {status: 400});
  }

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "save_product_settings") {
    const isEnabled = formData.get("isEnabled") === "true";
    const selectedStylesJson = formData.get("selectedStyles");
    const selectedProductBasesJson = formData.get("selectedProductBases");
    const reorderedStylesJson = formData.get("reorderedStyles");
    const variantMappingsJson = formData.get("variantMappings");

    let selectedStyles: string[] = [];
    let selectedProductBases: string[] = [];
    let reorderedStyles: Array<{ uuid: string; sortOrder: number }> = [];
    let variantMappings: Array<{
      productBaseVariantId: number;
      shopifyVariantId: string;
    }> = [];

    if (selectedStylesJson) {
      try {
        selectedStyles = JSON.parse(selectedStylesJson as string);
      } catch (error) {
        console.error("Error parsing selectedStyles:", error);
      }
    }

    if (selectedProductBasesJson) {
      try {
        selectedProductBases = JSON.parse(selectedProductBasesJson as string);
      } catch (error) {
        console.error("Error parsing selectedProductBases:", error);
      }
    }

    if (reorderedStylesJson) {
      try {
        reorderedStyles = JSON.parse(reorderedStylesJson as string);
      } catch (error) {
        console.error("Error parsing reorderedStyles:", error);
      }
    }

    if (variantMappingsJson) {
      try {
        variantMappings = JSON.parse(variantMappingsJson as string);
      } catch (error) {
        console.error("Error parsing variantMappings:", error);
      }
    }

    try {
      // Update our database
      await drizzleDb
        .update(productsTable)
        .set({
          isEnabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(productsTable.uuid, id));

      // Get the product from our database to get the numeric ID
      const dbProduct = await drizzleDb
        .select()
        .from(productsTable)
        .where(eq(productsTable.uuid, id))
        .limit(1);

      if (dbProduct.length > 0) {
        const productId = dbProduct[0].id;
        const shopifyGID = `gid://shopify/Product/${dbProduct[0].shopifyProductId}`;
        const currentDate = new Date().toISOString();

        // Get all AI styles for this shop to map UUIDs to IDs
        const shopId = getShopId(session.shop);
        const aiStyles = await drizzleDb
          .select()
          .from(aiStylesTable)
          .where(eq(aiStylesTable.shopId, shopId));

        const styleUuidToId = new Map(aiStyles.map(style => [style.uuid, style.id]));

        // First, delete all existing product-style relationships for this product
        await drizzleDb
          .delete(productStylesTable)
          .where(eq(productStylesTable.productId, productId));

        const currentTime = new Date().toISOString();

        // Then, insert new relationships for selected styles
        if (selectedStyles.length > 0) {
          // Create product-style relationships with proper ordering
          const productStylesToInsert = [];

          for (let index = 0; index < selectedStyles.length; index++) {
            const styleUuid = selectedStyles[index];
            const styleId = styleUuidToId.get(styleUuid);

            if (styleId) {
              // Check if we have reordered data for this style
              const reorderedStyle = reorderedStyles.find(rs => rs.uuid === styleUuid);
              const sortOrder = reorderedStyle ? reorderedStyle.sortOrder : index;

              productStylesToInsert.push({
                productId: productId,
                aiStyleId: styleId,
                sortOrder: sortOrder,
                isEnabled: true,
                createdAt: currentTime,
                updatedAt: currentTime,
              });
            }
          }

          if (productStylesToInsert.length > 0) {
            await drizzleDb
              .insert(productStylesTable)
              .values(productStylesToInsert);
          }
        }

        // Handle product bases (if provided)
        if (selectedProductBases) {
          // Get all product bases for this shop to map UUIDs to IDs
          const productBases = await drizzleDb
            .select()
            .from(productBasesTable)
            .where(eq(productBasesTable.shopId, shopId));

          const productBaseUuidToId = new Map(productBases.map(pb => [pb.uuid, pb.id]));

          // First, delete all existing product-product base relationships for this product
          await drizzleDb
            .delete(productProductBasesTable)
            .where(eq(productProductBasesTable.productId, productId));

          // Then, insert new relationships for selected product bases
          if (selectedProductBases.length > 0) {
            const productProductBasesToInsert = [];

            for (let index = 0; index < selectedProductBases.length; index++) {
              const productBaseUuid = selectedProductBases[index];
              const productBaseId = productBaseUuidToId.get(productBaseUuid);

              if (productBaseId) {
                productProductBasesToInsert.push({
                  productId: productId,
                  productBaseId: productBaseId,
                  sortOrder: index,
                  isEnabled: true,
                  createdAt: currentTime,
                  updatedAt: currentTime,
                });
              }
            }

            if (productProductBasesToInsert.length > 0) {
              await drizzleDb
                .insert(productProductBasesTable)
                .values(productProductBasesToInsert);
            }
          }
        }

        // Handle variant mappings as part of the main save action
        // This consolidates the save functionality and eliminates the need for a separate "save_variant_mappings" action
        if (variantMappings.length > 0 || true) { // Always process to ensure we clean up orphaned mappings
          // First, delete all existing mappings for this product
          // This ensures we don't have any stale mappings
          await drizzleDb
            .delete(productBaseVariantMappingsTable)
            .where(eq(productBaseVariantMappingsTable.productId, productId));

          // Then, insert new mappings
          // Only insert if there are actually mappings to insert
          if (variantMappings.length > 0) {
            const mappingsToInsert = variantMappings.map(mapping => ({
              productId: productId,
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
        }

        // Update metafields on the Shopify product (only basic info, not styles)
        const metafieldsInput = {
          id: shopifyGID,
          metafields: [
            {
              namespace: "ai_generator",
              key: "ai_enabled",
              value: isEnabled.toString(),
              type: "boolean"
            },
            {
              namespace: "ai_generator",
              key: "last_updated",
              value: currentDate,
              type: "date_time"
            }
          ]
        };

        try {
          await admin.graphql(
            `mutation UpdateProductMetafields($input: ProductInput!) {
              productUpdate(input: $input) {
                product { id }
                userErrors { field message }
              }
            }`,
            {
              variables: {input: metafieldsInput}
            }
          );
        } catch (error) {
          console.error("Error updating metafields:", error);
        }
      }

      return Response.json({
        success: true,
        message: `Product ${isEnabled ? 'enabled' : 'disabled'} for AI generation with ${selectedStyles.length} style(s), ${selectedProductBases?.length || 0} product base(s), and ${variantMappings.length} variant mapping(s) saved`
      });
    } catch (error) {
      console.error("Error updating product status:", error);
      return Response.json({error: "Failed to update product status"}, {status: 500});
    }
  }

  if (action === "save_variant_mappings") {
    const mappingsJson = formData.get("mappings");

    let mappings: Array<{
      productBaseVariantId: number;
      shopifyVariantId: string;
    }> = [];

    if (mappingsJson) {
      try {
        mappings = JSON.parse(mappingsJson as string);
      } catch (error) {
        console.error("Error parsing mappings:", error);
      }
    }

    try {
      // Get the product from our database to get the numeric ID
      const dbProduct = await drizzleDb
        .select()
        .from(productsTable)
        .where(eq(productsTable.uuid, id))
        .limit(1);

      if (dbProduct.length > 0) {
        const productId = dbProduct[0].id;
        const currentTime = new Date().toISOString();

        // First, delete all existing mappings for this product
        await drizzleDb
          .delete(productBaseVariantMappingsTable)
          .where(eq(productBaseVariantMappingsTable.productId, productId));

        // Then, insert new mappings
        if (mappings.length > 0) {
          const mappingsToInsert = mappings.map(mapping => ({
            productId: productId,
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

        return Response.json({
          success: true,
          message: `Variant mappings saved successfully`
        });
      }

      return Response.json({error: "Product not found"}, {status: 404});
    } catch (error) {
      console.error("Error saving variant mappings:", error);
      return Response.json({error: "Failed to save variant mappings"}, {status: 500});
    }
  }

  if (action === "create_variants") {
    const variantsToCreateJson = formData.get("variantsToCreate");

    let variantsToCreate: Array<{
      productBaseVariantId: number;
      options: Array<{ name: string; value: string }>;
    }> = [];

    if (variantsToCreateJson) {
      try {
        variantsToCreate = JSON.parse(variantsToCreateJson as string);
      } catch (error) {
        console.error("Error parsing variantsToCreate:", error);
      }
    }

    try {
      // Get the product from our database to get the Shopify product ID
      const dbProduct = await drizzleDb
        .select()
        .from(productsTable)
        .where(eq(productsTable.uuid, id))
        .limit(1);

      if (dbProduct.length > 0) {
        const shopifyGID = `gid://shopify/Product/${dbProduct[0].shopifyProductId}`;

        // Create variants in Shopify
        const variantInputs = variantsToCreate.map(variant => ({
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
          return Response.json({
            error: `Failed to create variants: ${errors.map((e: any) => e.message).join(', ')}`
          }, {status: 500});
        }

        return Response.json({
          success: true,
          message: `Successfully created ${variantsToCreate.length} new variant(s)`
        });
      }

      return Response.json({error: "Product not found"}, {status: 404});
    } catch (error) {
      console.error("Error creating variants:", error);
      return Response.json({error: "Failed to create variants"}, {status: 500});
    }
  }

  if (action === "update_variant_price") {
    const variantId = formData.get("variantId") as string;
    const newPrice = formData.get("newPrice") as string;

    try {
      // Get the product from our database to get the Shopify product ID
      const dbProduct = await drizzleDb
        .select()
        .from(productsTable)
        .where(eq(productsTable.uuid, id))
        .limit(1);

      if (dbProduct.length > 0) {
        const shopifyGID = `gid://shopify/Product/${dbProduct[0].shopifyProductId}`;

        // Update variant price in Shopify
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
                id: variantId,
                price: newPrice
              }]
            }
          }
        );

        const data = await response.json();

        if (data.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
          return Response.json({
            error: `Failed to update variant price: ${data.data.productVariantsBulkUpdate.userErrors.map((e: any) => e.message).join(', ')}`
          }, {status: 500});
        }

        return Response.json({
          success: true,
          message: `Variant price updated successfully`
        });
      }

      return Response.json({error: "Product not found"}, {status: 404});
    } catch (error) {
      console.error("Error updating variant price:", error);
      return Response.json({error: "Failed to update variant price"}, {status: 500});
    }
  }

  if (action === "delete_variant") {
    const variantId = formData.get("variantId") as string;

    try {
      // Get the product from our database to get the Shopify product ID
      const dbProduct = await drizzleDb
        .select()
        .from(productsTable)
        .where(eq(productsTable.uuid, id))
        .limit(1);

      if (dbProduct.length > 0) {
        const shopifyGID = `gid://shopify/Product/${dbProduct[0].shopifyProductId}`;

        // Delete variant in Shopify
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
              variantsIds: [variantId]
            }
          }
        );

        const data = await response.json();

        if (data.data?.productVariantsBulkDelete?.userErrors?.length > 0) {
          return Response.json({
            error: `Failed to delete variant: ${data.data.productVariantsBulkDelete.userErrors.map((e: any) => e.message).join(', ')}`
          }, {status: 500});
        }

        // Also remove any variant mappings for this variant
        // Extract the numeric ID from the Shopify GID
        const numericVariantId = extractShopifyId(variantId);
        await drizzleDb
          .delete(productBaseVariantMappingsTable)
          .where(eq(productBaseVariantMappingsTable.shopifyVariantId, numericVariantId));

        return Response.json({
          success: true,
          message: `Variant deleted successfully`
        });
      }

      return Response.json({error: "Product not found"}, {status: 404});
    } catch (error) {
      console.error("Error deleting variant:", error);
      return Response.json({error: "Failed to delete variant"}, {status: 500});
    }
  }

  return Response.json({error: "Invalid action"}, {status: 400});
};

// Main component
export default function ProductDetailPageNew() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const revalidator = useRevalidator();
  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback((formData: FormData) => {
    submit(formData, {method: "post"});
  }, [submit]);

  // Initial values for the ProductFormContext
  const initialValues = {
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
  };

  return (
    <ProductFormProvider initialValues={initialValues} onSubmit={handleSubmit}>
      <ProductDetailPageContent
        shopify={shopify}
        navigate={navigate}
        actionData={actionData}
        revalidator={revalidator}
        submit={submit}
      />
    </ProductFormProvider>
  );
}

// Content component that uses the ProductFormContext
function ProductDetailPageContent({
                                    shopify,
                                    navigate,
                                    actionData,
                                    revalidator,
                                    submit
                                  }: {
  shopify: any;
  navigate: any;
  actionData: ActionData | undefined;
  revalidator: any;
  submit: any;
}) {
  // Create a handleSubmit function that uses the submit prop
  const handleSubmit = useCallback((formData: FormData) => {
    submit(formData, {method: "post"});
  }, [submit]);
  const {
    state,
    toggleEnabled,
    toggleStyle,
    setSelectedStyles,
    toggleProductBase,
    setSelectedProductBases,
    updateVariantMapping,
    clearOrphanedMappings,
    setEditingVariantPrice,
    setCreatingVariants,
    isDirty,
    isLoading,
    isSaving,
    creatingVariants,
    submitForm,
    resetForm,
    hasError,
    errorMessage,
    successMessage,
  } = useProductForm();

  const {product} = state.original;
  const {shopifyProduct} = state.data;

  // Show/hide save bar based on changes
  useEffect(() => {
    if (shopify) {
      if (isDirty || isLoading) {
        shopify.saveBar.show('product-edit-save-bar');
      } else {
        shopify.saveBar.hide('product-edit-save-bar');
      }
    }
  }, [isDirty, isLoading, shopify]);

  // Handle action results
  useEffect(() => {
    if (actionData && shopify) {
      if ('success' in actionData && actionData.success) {
        // Show success toast
        shopify.toast.show(actionData.message, {duration: 3000});

        // Revalidate to refresh the data
        revalidator.revalidate();
      } else if ('error' in actionData && actionData.error) {
        // Show error toast
        shopify.toast.show(actionData.error, {duration: 8000, isError: true});

        // Scroll to top to ensure error banner is visible
        if (typeof window !== 'undefined') {
          window.scrollTo({top: 0, behavior: 'smooth'});
        }
      }
    }
  }, [actionData, shopify, revalidator]);

  return (
    <Page title={`${product.title}`}
          backAction={{
            content: 'Products',
            onAction: () => navigate('/app/products'),
          }}
    >
      <TitleBar title={`${product.title}`}>
        <BreadcrumbLink to="/app/products">
          Products
        </BreadcrumbLink>
      </TitleBar>

      <BlockStack gap="500">
        {/* Error Banner */}
        {hasError && (
          <Banner tone="critical" onDismiss={() => window.location.reload()}>
            <BlockStack gap="200">
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                Action Failed
              </Text>
              <Text variant="bodyMd" as="p">
                {errorMessage}
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                This error has also been shown as a notification. Click the × to dismiss and try again.
              </Text>
            </BlockStack>
          </Banner>
        )}

        {/* Success Banner */}
        {successMessage && (
          <Banner tone="success">
            <Text variant="bodyMd" as="p">
              {successMessage}
            </Text>
          </Banner>
        )}

        {state.data.updateNeeded && (
          <Banner tone="info">
            Product title was automatically updated from Shopify to keep data in sync.
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              {/* Product Details Card */}
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
                        <Badge tone={state.current.isEnabled ? "success" : "attention"}>
                          {state.current.isEnabled ? "AI Enabled" : "AI Disabled"}
                        </Badge>
                        {shopifyProduct?.status && (
                          <Badge tone={shopifyProduct.status === 'ACTIVE' ? "success" : "attention"}>
                            {shopifyProduct.status}
                          </Badge>
                        )}
                      </InlineStack>

                      <Checkbox
                        label="Enable for AI Generation"
                        checked={state.current.isEnabled}
                        onChange={toggleEnabled}
                        helpText="When enabled, customers can generate AI art for this product."
                        disabled={isLoading}
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
                          <InlineStack gap="300">
                            <Button
                              url={`https://${state.data.shop}/products/${shopifyProduct.handle}`}
                              target="_blank"
                              external
                              variant="plain"
                              size="slim"
                            >
                              View in Shop
                            </Button>
                            <Button
                              url={`https://${state.data.shop}/admin/products/${product.shopifyProductId}`}
                              target="_blank"
                              external
                              variant="plain"
                              size="slim"
                            >
                              Edit in Shopify
                            </Button>
                          </InlineStack>
                        )}
                      </InlineStack>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* AI Style Selection Card */}
              <AiStyleSelection
                aiStyles={state.data.aiStyles}
                onToggleStyle={toggleStyle}
                selectedStyles={state.current.selectedStyles}
                onSelectedStylesChange={setSelectedStyles}
                isLoading={isLoading}
              />

              {/* Product Bases Selection Card */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Product Bases Selection
                  </Text>

                  {state.data.productBases.length > 0 ? (
                    <BlockStack gap="400">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Select which product bases apply to this product. Product bases define the physical variants
                        that customers can choose from.
                      </Text>

                      <div style={{
                        border: '1px solid var(--p-border-subdued)',
                        borderRadius: 'var(--p-border-radius-200)',
                        overflow: 'hidden'
                      }}>
                        {state.data.productBases.map((productBase, index) => {
                          const isSelected = state.current.selectedProductBases.includes(productBase.uuid);
                          const isLast = index === state.data.productBases.length - 1;

                          return (
                            <div
                              key={productBase.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 16px',
                                backgroundColor: isSelected ? 'var(--p-surface-selected)' : 'var(--p-surface)',
                                borderBottom: isLast ? 'none' : '1px solid var(--p-border-subdued)',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.1s ease',
                              }}
                              onClick={isLoading ? undefined : () => {
                                const newIsSelected = !isSelected;
                                toggleProductBase(productBase.uuid, newIsSelected);

                                // If deselecting a product base, clean up orphaned mappings
                                if (!newIsSelected) {
                                  // Get all product base variant IDs that are still valid
                                  const validProductBaseVariantIds = state.data.productBaseVariants
                                    .filter(v => {
                                      // Check if the variant's product base is still selected
                                      const productBaseUuid = v.productBase?.uuid;
                                      const productBaseStillSelected = productBaseUuid &&
                                        state.current.selectedProductBases
                                          .filter(uuid => uuid !== productBase.uuid) // Exclude the one being deselected
                                          .includes(productBaseUuid);
                                      return productBaseStillSelected;
                                    })
                                    .map(v => v.id);

                                  // Clear orphaned mappings
                                  clearOrphanedMappings(validProductBaseVariantIds);
                                }
                              }}
                            >
                              <div style={{marginRight: '12px', flexShrink: 0}}>
                                <Checkbox
                                  label={`${isSelected ? 'Remove' : 'Add'} ${productBase.name}`}
                                  labelHidden
                                  checked={isSelected}
                                  onChange={() => toggleProductBase(productBase.uuid, !isSelected)}
                                  disabled={isLoading}
                                />
                              </div>
                              <div style={{flex: 1, minWidth: 0}}>
                                <BlockStack gap="100">
                                  <InlineStack gap="200" align="start">
                                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                                      {productBase.name}
                                    </Text>
                                    <Badge
                                      tone={productBase.isActive ? "success" : "critical"}
                                      size="small"
                                    >
                                      {productBase.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                    {isSelected && (
                                      <Badge tone="info" size="small">
                                        Selected
                                      </Badge>
                                    )}
                                  </InlineStack>
                                  {productBase.description && (
                                    <Text variant="bodySm" tone="subdued" as="span">
                                      {productBase.description}
                                    </Text>
                                  )}
                                </BlockStack>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <InlineStack gap="200" align="space-between">
                        <Text variant="bodySm" tone="subdued" as="span">
                          {state.current.selectedProductBases.length} of {state.data.productBases.length} product bases
                          selected
                        </Text>
                        {state.current.selectedProductBases.length > 0 && (
                          <Button
                            variant={'plain'}
                            size={'slim'}
                            onClick={() => setSelectedProductBases([])}
                            disabled={isLoading}
                          >
                            Clear all
                          </Button>
                        )}
                      </InlineStack>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="300">
                      <Text variant="bodyMd" tone="subdued" as="p">
                        No product bases have been created yet.
                      </Text>
                      <Button variant="primary" url="/app/productbase" disabled={isLoading}>
                        Create Product Bases
                      </Button>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              {/* Variant Mapping Card */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="300" align="space-between">
                    <Text as="h2" variant="headingMd">
                      Product Variants
                      {state.current.selectedProductBases.length > 0 ?
                        ` (${state.data.shopifyProduct?.variants?.edges?.length || 0} Shopify + ${state.data.productBaseVariants.filter(v =>
                          !state.current.variantMappings.some(m => m.productBaseVariantId === v.id)
                        ).length} Unmapped Product Base)` :
                        ` (${state.data.shopifyProduct?.variants?.edges?.length || 0})`
                      }
                    </Text>

                    {state.current.selectedProductBases.length > 0 && (
                      <InlineStack gap="200">
                        {/* Create Missing Variants Button */}
                        {state.data.productBaseVariants.filter(v =>
                          !state.current.variantMappings.some(m => m.productBaseVariantId === v.id)
                        ).length > 0 && (
                          <button
                            className="Polaris-Button Polaris-Button--sizeSlim Polaris-Button--secondary"
                            onClick={() => {
                              setCreatingVariants(true);

                              // Get unmapped product base variants
                              const unmappedVariants = state.data.productBaseVariants.filter(v =>
                                !state.current.variantMappings.some(m => m.productBaseVariantId === v.id)
                              );

                              // Prepare variants to create
                              const variantsToCreate = unmappedVariants.map(variant => {
                                // Get option values for this variant
                                const options = state.data.productBaseVariantOptionValues
                                  .filter(v => v.productBaseVariantId === variant.id)
                                  .map(v => {
                                    const option = state.data.productBaseOptions.find(o => o.id === v.productBaseOptionId);
                                    return {
                                      name: option?.name || '',
                                      value: v.value
                                    };
                                  });

                                return {
                                  productBaseVariantId: variant.id,
                                  options
                                };
                              });

                              // Submit the form
                              const formData = new FormData();
                              formData.append("action", "create_variants");
                              formData.append("variantsToCreate", JSON.stringify(variantsToCreate));
                              handleSubmit(formData);
                            }}
                            disabled={isLoading || creatingVariants}
                            type="button"
                          >
                            {creatingVariants ? 'Creating Variants...' : `Create All Missing Variants (${
                              state.data.productBaseVariants.filter(v =>
                                !state.current.variantMappings.some(m => m.productBaseVariantId === v.id)
                              ).length
                            })`}
                          </button>
                        )}

                        {/* Note about variant mappings being saved automatically */}
                        <Text variant="bodySm" tone="subdued" as="span">
                          Variant mappings are saved automatically when you save changes
                        </Text>
                      </InlineStack>
                    )}
                  </InlineStack>

                  {/* Variant Mapping Table - Simplified Version */}
                  {state.data.shopifyProduct?.variants?.edges?.length > 0 || state.data.productBaseVariants.length > 0 ? (
                    <IndexTable
                      resourceName={{ singular: 'variant', plural: 'variants' }}
                      itemCount={
                        (state.data.shopifyProduct?.variants?.edges?.length || 0) +
                        (state.current.selectedProductBases.length > 0 ?
                          state.data.productBaseVariants.filter(v => !state.current.variantMappings.some(m => m.productBaseVariantId === v.id)).length :
                          0)
                      }
                      headings={[
                        { title: 'Variant Details' },
                        { title: 'Price' },
                        { title: 'Status' },
                        ...(state.current.selectedProductBases.length > 0 ? [{ title: 'Product Base Mapping' }] : []),
                        { title: 'Actions' }
                      ]}
                      selectable={false}
                    >
                      {/* Shopify Variants */}
                      {state.data.shopifyProduct?.variants?.edges?.map((edge, index) => {
                        const variant = edge.node;
                        const mapping = state.current.variantMappings.find(m => String(m.shopifyVariantId) === extractShopifyId(variant.id));
                        const mappedProductBaseVariant = mapping ?
                          state.data.productBaseVariants.find(v => v.id === mapping.productBaseVariantId) :
                          null;

                        return (
                          <IndexTable.Row
                            id={variant.id}
                            key={variant.id}
                            position={index}
                          >
                            <IndexTable.Cell>
                              <BlockStack gap="100">
                                <Text variant="bodyMd" fontWeight="semibold" as="span">
                                  {variant.title}
                                </Text>
                                {variant.selectedOptions?.length > 0 && (
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    Options: {variant.selectedOptions.map(option => `${option.name}: ${option.value}`).join(', ')}
                                  </Text>
                                )}
                                <Badge tone="info" size="small">Shopify Variant</Badge>
                              </BlockStack>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              {state.current.editingVariantPrices[variant.id] ? (
                                <InlineStack gap="200" align="start">
                                  <input
                                    type="number"
                                    value={state.current.editingVariantPrices[variant.id]}
                                    onChange={(e) => setEditingVariantPrice(variant.id, e.target.value)}
                                    style={{
                                      padding: '8px',
                                      borderRadius: '4px',
                                      border: '1px solid #ccc',
                                      width: '100px'
                                    }}
                                  />
                                  <Button
                                    variant={'primary'}
                                    size={'slim'}
                                    onClick={() => {
                                      // Submit the form to update the variant price
                                      const formData = new FormData();
                                      formData.append("action", "update_variant_price");
                                      formData.append("variantId", variant.id);
                                      formData.append("newPrice", state.current.editingVariantPrices[variant.id]);
                                      handleSubmit(formData);

                                      // Clear the editing state
                                      setEditingVariantPrice(variant.id, null);
                                    }}
                                    disabled={isLoading}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size={'slim'}
                                    onClick={() => setEditingVariantPrice(variant.id, null)}
                                    disabled={isLoading}
                                  >
                                    Cancel
                                  </Button>
                                </InlineStack>
                              ) : (
                                <InlineStack gap="200" align="start">
                                  <Text variant="bodyMd" as="span">
                                    ${variant.price}
                                  </Text>
                                  <Button
                                    size={'slim'}
                                    onClick={() => setEditingVariantPrice(variant.id, variant.price)}
                                    disabled={isLoading}
                                  >
                                    Edit
                                  </Button>
                                </InlineStack>
                              )}
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Badge tone={variant.availableForSale ? "success" : "critical"}>
                                {variant.availableForSale ? "Available" : "Unavailable"}
                              </Badge>
                            </IndexTable.Cell>
                            {state.current.selectedProductBases.length > 0 && (
                              <IndexTable.Cell>
                                <select
                                  value={mapping?.productBaseVariantId || ''}
                                  onChange={(e) => {
                                    const productBaseVariantId = e.target.value ? parseInt(e.target.value) : null;
                                    if (productBaseVariantId) {
                                      // Adding or changing a mapping
                                      // Pass the productBaseVariantId and shopifyVariantId to create/update the mapping
                                      // Extract the numeric ID from the Shopify variant's GID
                                      updateVariantMapping(productBaseVariantId, extractShopifyId(variant.id));
                                    } else {
                                      // Removing a mapping - if mapping exists, remove it
                                      // Fixed: When selecting "No Mapping", properly remove the existing mapping
                                      // by passing the existing productBaseVariantId and null for shopifyVariantId
                                      if (mapping) {
                                        updateVariantMapping(mapping.productBaseVariantId, null);
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    minWidth: '200px'
                                  }}
                                >
                                  <option value="">— No Mapping —</option>
                                  {state.data.productBaseVariants.map(baseVariant => (
                                    <option key={baseVariant.id} value={baseVariant.id}>
                                      {baseVariant.productBase?.name} - {baseVariant.name}
                                    </option>
                                  ))}
                                </select>
                                {mappedProductBaseVariant && (
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    {mappedProductBaseVariant.widthPx} × {mappedProductBaseVariant.heightPx}px
                                  </Text>
                                )}
                              </IndexTable.Cell>
                            )}
                            <IndexTable.Cell>
                              {!mapping && (
                                <Button
                                  variant={'plain'}
                                  tone={'critical'}
                                  size={'slim'}
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this variant? This action cannot be undone.")) {
                                      // Submit the form to delete the variant
                                      const formData = new FormData();
                                      formData.append("action", "delete_variant");
                                      formData.append("variantId", variant.id);
                                      handleSubmit(formData);
                                    }
                                  }}
                                  disabled={isLoading}
                                >
                                  Delete Shopify Variant
                                </Button>
                              )}
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        );
                      })}

                      {/* Unmapped Product Base Variants */}
                      {state.current.selectedProductBases.length > 0 &&
                        state.data.productBaseVariants
                          .filter(v => !state.current.variantMappings.some(m => m.productBaseVariantId === v.id))
                          .map((baseVariant, index) => (
                            <IndexTable.Row
                              id={`unmapped-${baseVariant.id}`}
                              key={`unmapped-${baseVariant.id}`}
                              position={(state.data.shopifyProduct?.variants?.edges?.length || 0) + index}
                            >
                              <IndexTable.Cell>
                                <BlockStack gap="100">
                                  <Text variant="bodyMd" fontWeight="semibold" as="span">
                                    {baseVariant.productBase?.name} - {baseVariant.name}
                                  </Text>
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    Dimensions: {baseVariant.widthPx} × {baseVariant.heightPx}px
                                  </Text>
                                  <Badge tone="warning" size="small">Product Base Variant</Badge>
                                </BlockStack>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  No Shopify variant
                                </Text>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <Badge tone="critical">
                                  Needs Shopify Variant
                                </Badge>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <Button
                                  variant={'primary'}
                                  size={'slim'}
                                  onClick={() => {
                                    setCreatingVariants(true);

                                    // Get option values for this variant
                                    const options = state.data.productBaseVariantOptionValues
                                      .filter(v => v.productBaseVariantId === baseVariant.id)
                                      .map(v => {
                                        const option = state.data.productBaseOptions.find(o => o.id === v.productBaseOptionId);
                                        return {
                                          name: option?.name || '',
                                          value: v.value
                                        };
                                      });

                                    // Prepare variant to create
                                    const variantsToCreate = [{
                                      productBaseVariantId: baseVariant.id,
                                      options
                                    }];

                                    // Submit the form using the handleSubmit function
                                    const formData = new FormData();
                                    formData.append("action", "create_variants");
                                    formData.append("variantsToCreate", JSON.stringify(variantsToCreate));
                                    handleSubmit(formData);
                                  }}
                                  disabled={isLoading || creatingVariants}
                                >
                                  {creatingVariants ? 'Creating...' : 'Create Shopify Variant'}
                                </Button>
                              </IndexTable.Cell>
                            </IndexTable.Row>
                          ))
                      }
                    </IndexTable>
                  ) : (
                    <Text variant="bodyMd" tone="subdued" as="p">
                      No variants found for this product.
                    </Text>
                  )}
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
          onClick={submitForm}
          loading={isLoading ? "" : undefined}
          disabled={isLoading}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={resetForm}
          disabled={isLoading}
        >
          Discard
        </button>
      </SaveBar>
    </Page>
  );
}
