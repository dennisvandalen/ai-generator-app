import { db } from "~/db.server";
import { productBaseVariants } from "~/db/schema";
import { withZodHandler } from "~/utils/withZodHandler";
import { z } from "zod";

const createVariantSchema = z.object({
  productBaseId: z.string(),
  name: z.string().min(1, "Name is required"),
  width: z.number().min(1, "Width must be greater than 0"),
  height: z.number().min(1, "Height must be greater than 0"),
  optionValues: z.record(z.string(), z.string()),
});

export const createVariant = withZodHandler(
  createVariantSchema,
  async ({ request, context: { session } }, data) => {

    try {
      const [newVariant] = await db
        .insert(productBaseVariantsTable)
        .values({
          productBaseId: data.productBaseId,
          name: data.name,
          widthPx: data.width,
          heightPx: data.height,
          // Store option values in a separate table if needed
          // For now, we'll skip this as it's not in the schema
          isActive: true,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          uuid: crypto.randomUUID(), // Generate a UUID for the variant
        })
        .returning();

      return {
        success: true,
        variant: newVariant,
        message: "Variant created successfully",
      };
    } catch (error) {
      console.error("Error creating variant:", error);
      return {
        success: false,
        error: "Failed to create variant",
      };
    }
  }
);
