import { db } from "~/db.server";
import { productBaseVariants } from "~/db/schema";
import { withZodHandler } from "~/utils/withZodHandler";
import { z } from "zod";
import { eq } from "drizzle-orm";

const updateVariantSchema = z.object({
  variantId: z.string(),
  name: z.string().min(1, "Name is required"),
  width: z.number().min(1, "Width must be greater than 0"),
  height: z.number().min(1, "Height must be greater than 0"),
  optionValues: z.record(z.string(), z.string()),
});

export const updateVariant = withZodHandler(
  updateVariantSchema,
  async ({ request, context: { session } }, data) => {

    try {
      const [updatedVariant] = await db
        .update(productBaseVariants)
        .set({
          name: data.name,
          width: data.width,
          height: data.height,
          optionValues: JSON.stringify(data.optionValues),
          updatedAt: new Date(),
        })
        .where(eq(productBaseVariants.id, data.variantId))
        .returning();

      if (!updatedVariant) {
        return {
          success: false,
          error: "Variant not found",
        };
      }

      return {
        success: true,
        variant: updatedVariant,
        message: "Variant updated successfully",
      };
    } catch (error) {
      console.error("Error updating variant:", error);
      return {
        success: false,
        error: "Failed to update variant",
      };
    }
  }
);
