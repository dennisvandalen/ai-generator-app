import type {ActionFunctionArgs} from "@remix-run/node";
import {json} from "@remix-run/node";
import {authenticate} from "~/shopify.server";
import {getShopId} from "~/utils/getShopId";
import {ProductBaseFormSchema} from "~/schemas/productBase";
import {withZodHandler} from "~/utils/withZodHandler";
import drizzleDb from "~/db.server";
import {
  productBasesTable,
  productBaseOptionsTable, productBaseVariantsTable, productBaseVariantOptionValuesTable,
  type NewProductBase,
  type NewProductBaseOption,
} from "~/db/schema";
import {randomUUID} from "crypto";
import {eq} from "drizzle-orm";

export const action = withZodHandler(
  ProductBaseFormSchema,
  async ({request}: ActionFunctionArgs, data) => {
    const {session} = await authenticate.admin(request);
    const shopId = getShopId(session.shop);

    const newProductBase: NewProductBase = {
      uuid: randomUUID(),
      shopId,
      name: data.name,
      description: data.description || null,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert the product base first to get its ID
    const result = await drizzleDb.insert(productBasesTable).values(newProductBase);
    const productBaseId = result.lastInsertRowid as number;

    // Insert options into the options table
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
      message: `Product Base "${data.name}" created successfully`,
      productBase: newProductBase,
    });
  }
);
