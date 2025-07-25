import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { getShopId } from "~/utils/getShopId";
import { ProductBaseFormSchema } from "~/schemas/productBase";
import { withZodHandler } from "~/utils/withZodHandler";
import drizzleDb from "~/db.server";
import {
  productBasesTable,
  productBaseOptionsTable,
  productBaseVariantsTable,
  productBaseVariantOptionValuesTable,
  type NewProductBaseOption,
} from "~/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const action = withZodHandler(
  ProductBaseFormSchema,
  async ({ request }: ActionFunctionArgs, data) => {
    const { session } = await authenticate.admin(request);
    const shopId = getShopId(session.shop);

    if (!data.id) {
      return json({ success: false, error: "Product base ID is required" }, { status: 400 });
    }

    // Update the product base
    await drizzleDb
      .update(productBasesTable)
      .set({
        name: data.name,
        description: data.description || null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(productBasesTable.uuid, data.id),
          eq(productBasesTable.shopId, shopId)
        )
      );

    // Get the product base ID for updating options
    const productBase = await drizzleDb
      .select({ id: productBasesTable.id })
      .from(productBasesTable)
      .where(
        and(
          eq(productBasesTable.uuid, data.id),
          eq(productBasesTable.shopId, shopId)
        )
      );

    if (!productBase.length) {
      return json({ success: false, error: "Product base not found" }, { status: 404 });
    }

    const productBaseId = productBase[0].id;

    // Delete existing variants and their option values (cascade)
    await drizzleDb
      .delete(productBaseVariantOptionValuesTable)
      .where(
        eq(productBaseVariantOptionValuesTable.productBaseVariantId, 
          drizzleDb.select({ id: productBaseVariantsTable.id })
            .from(productBaseVariantsTable)
            .where(eq(productBaseVariantsTable.productBaseId, productBaseId))
        )
      );
    
    await drizzleDb
      .delete(productBaseVariantsTable)
      .where(eq(productBaseVariantsTable.productBaseId, productBaseId));

    // Delete existing options
    await drizzleDb
      .delete(productBaseOptionsTable)
      .where(eq(productBaseOptionsTable.productBaseId, productBaseId));

    // Insert new options
    if (data.optionNames && data.optionNames.length > 0) {
      const optionsToInsert: NewProductBaseOption[] = data.optionNames.map((optionName, index) => ({
        productBaseId,
        name: optionName,
        sortOrder: index,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await drizzleDb.insert(productBaseOptionsTable).values(optionsToInsert);
    }

    // Insert variants if provided
    if (data.variants && data.variants.length > 0) {
      // Get the options we just created to map option names to IDs
      const createdOptions = await drizzleDb
        .select()
        .from(productBaseOptionsTable)
        .where(eq(productBaseOptionsTable.productBaseId, productBaseId));

      const optionNameToId = new Map<string, number>();
      createdOptions.forEach(option => {
        optionNameToId.set(option.name, option.id);
      });

      for (const [index, variant] of data.variants.entries()) {
        // Insert the variant
        const variantResult = await drizzleDb.insert(productBaseVariantsTable).values({
          uuid: randomUUID(),
          productBaseId,
          name: variant.name,
          widthPx: variant.widthPx,
          heightPx: variant.heightPx,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice ?? null,
          isActive: true,
          sortOrder: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const variantId = variantResult.lastInsertRowid as number;

        // Insert option values for this variant
        if (variant.optionValues && Object.keys(variant.optionValues).length > 0) {
          for (const [optionName, value] of Object.entries(variant.optionValues)) {
            const optionId = optionNameToId.get(optionName);
            if (optionId && value) {
              await drizzleDb.insert(productBaseVariantOptionValuesTable).values({
                productBaseVariantId: variantId,
                productBaseOptionId: optionId,
                value,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return json({
      success: true,
      message: `Product Base "${data.name}" updated successfully`,
    });
  }
);