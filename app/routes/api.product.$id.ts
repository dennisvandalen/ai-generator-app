import type {LoaderFunctionArgs} from "@remix-run/node";
import drizzleDb from "../db.server";
import {
  productsTable,
  aiStylesTable,
  productStylesTable,
  productBaseVariantsTable,
  productBaseVariantMappingsTable
} from "~/db/schema";
import {eq, and} from "drizzle-orm";
import {getShopId} from "~/utils/getShopId";
import {authenticate} from "~/shopify.server";

// Define types for product styles data
interface AiStyle {
  id: number;
  uuid: string;
  name: string;
  promptTemplate: string;
  exampleImageUrl: string | null;
  isActive: boolean | null;
}

interface ProductStyle {
  id: number;
  sortOrder: number | null;
  isEnabled: boolean | null;
  aiStyle: AiStyle | null;
}

export const loader = async ({request, params}: LoaderFunctionArgs) => {
  const {id} = params;

  if (!id) {
    return Response.json({error: "Product ID is required"}, {status: 400});
  }

  let shop: string | null = null;
  let shopId: string | null = null;

  if (process.env.NODE_ENV === "development") {
    // In dev, use the shop param directly
    const url = new URL(request.url);
    shop = url.searchParams.get("shop");
    if (!shop) {
      return Response.json({error: "Shop parameter is required (dev mode)"}, {status: 400});
    }
    shopId = getShopId(shop);
  } else {
    // In prod, use Shopify app proxy authentication
    const {session} = await authenticate.public.appProxy(request);
    if (!session?.shop) {
      return Response.json({error: "Shopify authentication failed"}, {status: 401});
    }
    shop = session.shop;
    shopId = getShopId(shop);
  }

  try {
    // Fetch the product from our database by Shopify product ID
    const product = await drizzleDb
      .select()
      .from(productsTable)
      .where(and(
        eq(productsTable.shopifyProductId, parseInt(id)),
        eq(productsTable.shopId, shopId)
      ))
      .limit(1);

    if (product.length === 0) {
      return Response.json({error: "Product not found or not enabled for AI generation"}, {status: 404});
    }

    const productData = product[0];

    // If product is not enabled, return minimal data
    if (!productData.isEnabled) {
      return Response.json({
        enabled: false,
        message: "AI generation is not enabled for this product"
      });
    }

    // Fetch product-style relationships with AI style details
    const productStyles = await drizzleDb
      .select({
        id: productStylesTable.id,
        sortOrder: productStylesTable.sortOrder,
        isEnabled: productStylesTable.isEnabled,
        aiStyle: {
          id: aiStylesTable.id,
          uuid: aiStylesTable.uuid,
          name: aiStylesTable.name,
          promptTemplate: aiStylesTable.promptTemplate,
          exampleImageUrl: aiStylesTable.exampleImageUrl,
          isActive: aiStylesTable.isActive,
        }
      })
      .from(productStylesTable)
      .leftJoin(aiStylesTable, eq(productStylesTable.aiStyleId, aiStylesTable.id))
      .where(and(
        eq(productStylesTable.productId, productData.id),
        eq(productStylesTable.isEnabled, true)
      ))
      .orderBy(productStylesTable.sortOrder);

    console.log('productStyles', productStyles)

    // Filter out null styles and inactive styles, then sort by order
    const availableStyles = productStyles
      .filter((ps: ProductStyle) => {
        // Ensure aiStyle exists and is active before including it
        return ps && ps.aiStyle && typeof ps.aiStyle === 'object' && ps.aiStyle.isActive === true;
      })
      .sort((a: ProductStyle, b: ProductStyle) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((ps: ProductStyle) => {
        // Double-check that aiStyle exists before accessing its properties
        if (!ps.aiStyle) {
          return {
            id: null,
            name: null,
            exampleImageUrl: null,
            order: ps.sortOrder || 0,
          };
        }
        return {
          id: ps.aiStyle.uuid,
          name: ps.aiStyle.name,
          exampleImageUrl: ps.aiStyle.exampleImageUrl,
          order: ps.sortOrder || 0,
        };
      });

    // Fetch product variant mappings with their dimensions
    const variantMappings = await drizzleDb
      .select({
        shopifyVariantId: productBaseVariantMappingsTable.shopifyVariantId,
        productBaseVariantId: productBaseVariantMappingsTable.productBaseVariantId,
        widthPx: productBaseVariantsTable.widthPx,
        heightPx: productBaseVariantsTable.heightPx
      })
      .from(productBaseVariantMappingsTable)
      .leftJoin(
        productBaseVariantsTable,
        eq(productBaseVariantMappingsTable.productBaseVariantId, productBaseVariantsTable.id)
      )
      .where(and(
        eq(productBaseVariantMappingsTable.productId, productData.id),
        eq(productBaseVariantMappingsTable.isActive, true)
      ));

    // Format variant data for response
    const variants = variantMappings.map(mapping => ({
      variantId: mapping.shopifyVariantId,
      dimensions: {
        width: mapping.widthPx,
        height: mapping.heightPx
      }
    }));

    return Response.json({
      enabled: true,
      product: {
        id: productData.shopifyProductId,
        title: productData.title,
        uuid: productData.uuid,
      },
      styles: availableStyles,
      variants: variants,
      config: {
        totalStyles: availableStyles.length,
        lastUpdated: productData.updatedAt,
      }
    });

  } catch (error) {
    console.error("Error fetching product data:", error);
    return Response.json({error: "Internal server error"}, {status: 500});
  }
};
