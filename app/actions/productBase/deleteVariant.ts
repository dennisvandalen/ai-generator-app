import { db } from "~/db.server";
import { productBaseVariants } from "~/db/schema";
import { withZodHandler } from "~/utils/withZodHandler";
import { z } from "zod";
import { eq } from "drizzle-orm";

const deleteVariantSchema = z.object({
  variantId: z.string(),
});

export const deleteVariant = withZodHandler(
  deleteVariantSchema,
  async ({ request, context: { session } }, data) => {

    try {
      const [deletedVariant] = await db
        .delete(productBaseVariants)
        .where(eq(productBaseVariants.id, data.variantId))
        .returning();

      if (!deletedVariant) {
        return {
          success: false,
          error: "Variant not found",
        };
      }

      return {
        success: true,
        message: "Variant deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting variant:", error);
      return {
        success: false,
        error: "Failed to delete variant",
      };
    }
  }
);
