import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import drizzleDb from "../db.server";
import { productsTable, sizesTable, aiStylesTable, productStylesTable } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getShopId } from "../utils/getShopId";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { id } = params;
  
  if (!id) {
    return json({ error: "Product ID is required" }, { status: 400 });
  }

  let shop: string | null = null;
  let shopId: string | null = null;

  if (process.env.NODE_ENV === "development") {
    // In dev, use the shop param directly
    const url = new URL(request.url);
    shop = url.searchParams.get("shop");
    if (!shop) {
      return json({ error: "Shop parameter is required (dev mode)" }, { status: 400 });
    }
    shopId = getShopId(shop);
  } else {
    // In prod, use Shopify app proxy authentication
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) {
      return json({ error: "Shopify authentication failed" }, { status: 401 });
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
      return json({ error: "Product not found or not enabled for AI generation" }, { status: 404 });
    }

    const productData = product[0];

    // If product is not enabled, return minimal data
    if (!productData.isEnabled) {
      return json({
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

    // Filter out inactive styles and sort by order
    const availableStyles = productStyles
      .filter((ps: any) => ps.aiStyle?.isActive)
      .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((ps: any) => ({
        id: ps.aiStyle!.uuid,
        name: ps.aiStyle!.name,
        // promptTemplate: ps.aiStyle!.promptTemplate,
        exampleImageUrl: ps.aiStyle!.exampleImageUrl,
        order: ps.sortOrder || 0,
      }));

    // Fetch available sizes for this product
    const sizes = await drizzleDb
      .select({
        id: sizesTable.uuid,
        name: sizesTable.name,
        widthPx: sizesTable.widthPx,
        heightPx: sizesTable.heightPx,
        sortOrder: sizesTable.sortOrder,
      })
      .from(sizesTable)
      .where(and(
        eq(sizesTable.productId, productData.id),
        eq(sizesTable.isActive, true)
      ))
      .orderBy(sizesTable.sortOrder);

    return json({
      enabled: true,
      product: {
        id: productData.shopifyProductId,
        title: productData.title,
        uuid: productData.uuid,
      },
      styles: availableStyles,
      sizes: sizes,
      config: {
        totalStyles: availableStyles.length,
        totalSizes: sizes.length,
        lastUpdated: productData.updatedAt,
      }
    });

  } catch (error) {
    console.error("Error fetching product data:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}; 