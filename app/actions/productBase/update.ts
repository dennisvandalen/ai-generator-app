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
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

export const update = withZodHandler(
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
      .select()
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

    // Smart update strategy to preserve existing variants and their relationships
    
    // 1. Get existing variants and options
    const existingVariants = await drizzleDb
      .select()
      .from(productBaseVariantsTable)
      .where(eq(productBaseVariantsTable.productBaseId, productBaseId));

    const existingOptions = await drizzleDb
      .select()
      .from(productBaseOptionsTable)
      .where(eq(productBaseOptionsTable.productBaseId, productBaseId));

    // 2. Handle options (still safe to recreate since they don't have external relationships)
    await drizzleDb
      .delete(productBaseOptionsTable)
      .where(eq(productBaseOptionsTable.productBaseId, productBaseId));

    const optionNameToId = new Map<string, number>();
    if (data.optionNames && data.optionNames.length > 0) {
      const optionsToInsert: NewProductBaseOption[] = data.optionNames.map((optionName, index) => ({
        productBaseId,
        name: optionName,
        sortOrder: index,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await drizzleDb.insert(productBaseOptionsTable).values(optionsToInsert);
      
      const createdOptions = await drizzleDb
        .select()
        .from(productBaseOptionsTable)
        .where(eq(productBaseOptionsTable.productBaseId, productBaseId));

      createdOptions.forEach(option => {
        optionNameToId.set(option.name, option.id);
      });
    }

    // 3. Smart variant updates - preserve existing IDs where possible
    if (data.variants && data.variants.length > 0) {
      // Map existing variants by their ID for updates
      const existingVariantIds = new Set(existingVariants.map(v => v.id));
      const incomingVariantIds = new Set(
        data.variants.filter(v => v.id).map(v => v.id)
      );

      // Delete variants that are no longer present (only if they have IDs)
      const variantsToDelete = existingVariants.filter(
        existing => !incomingVariantIds.has(existing.id)
      );
      
      if (variantsToDelete.length > 0) {
        const variantIdsToDelete = variantsToDelete.map(v => v.id);
        
        // Delete option values for variants being deleted
        await drizzleDb
          .delete(productBaseVariantOptionValuesTable)
          .where(
            inArray(productBaseVariantOptionValuesTable.productBaseVariantId, variantIdsToDelete)
          );
        
        // Delete the variants themselves
        await drizzleDb
          .delete(productBaseVariantsTable)
          .where(inArray(productBaseVariantsTable.id, variantIdsToDelete));
      }

      // Process each variant from the form data
      for (const [index, variant] of data.variants.entries()) {
        let variantId: number;

        if (variant.id && existingVariantIds.has(variant.id)) {
          // Update existing variant - PRESERVE THE ID!
          await drizzleDb
            .update(productBaseVariantsTable)
            .set({
              name: variant.name,
              widthPx: variant.widthPx,
              heightPx: variant.heightPx,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice ?? null,
              sortOrder: index,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(productBaseVariantsTable.id, variant.id));
          
          variantId = variant.id;
        } else {
          // Create new variant
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
          
          variantId = Number(variantResult.lastInsertRowid);
        }

        // Handle option values for this variant
        // Delete existing option values for this variant first
        await drizzleDb
          .delete(productBaseVariantOptionValuesTable)
          .where(eq(productBaseVariantOptionValuesTable.productBaseVariantId, variantId));

        // Insert new option values
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
    } else {
      // No variants provided - delete all existing variants
      if (existingVariants.length > 0) {
        const variantIds = existingVariants.map(v => v.id);
        await drizzleDb
          .delete(productBaseVariantOptionValuesTable)
          .where(
            inArray(productBaseVariantOptionValuesTable.productBaseVariantId, variantIds)
          );
        await drizzleDb
          .delete(productBaseVariantsTable)
          .where(eq(productBaseVariantsTable.productBaseId, productBaseId));
      }
    }

    return json({
      success: true,
      message: `Product Base "${data.name}" updated successfully`,
    });
  }
);