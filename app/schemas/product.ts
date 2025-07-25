import { z } from "zod";

// Schema for variant mapping
export const VariantMappingSchema = z.object({
  productBaseVariantId: z.number(),
  shopifyVariantId: z.string(),
});

// Schema for reordered styles
export const ReorderedStyleSchema = z.object({
  uuid: z.string(),
  sortOrder: z.number(),
});

// Schema for variant creation
export const VariantCreationSchema = z.object({
  productBaseVariantId: z.number(),
  options: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })),
});

// Main product settings save schema
export const ProductSettingsSchema = z.object({
  isEnabled: z.boolean(),
  selectedStyles: z.array(z.string()).default([]),
  selectedProductBases: z.array(z.string()).default([]),
  reorderedStyles: z.array(ReorderedStyleSchema).default([]),
  variantMappings: z.array(VariantMappingSchema).default([]),
});

// Schema for variant price update
export const VariantPriceUpdateSchema = z.object({
  variantId: z.string(),
  newPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal number"),
});

// Schema for variant deletion
export const VariantDeletionSchema = z.object({
  variantId: z.string(),
});

// Schema for variant creation action
export const VariantCreationActionSchema = z.object({
  variantsToCreate: z.array(VariantCreationSchema),
});

// Export types
export type ProductSettingsData = z.infer<typeof ProductSettingsSchema>;
export type VariantMappingData = z.infer<typeof VariantMappingSchema>;
export type ReorderedStyleData = z.infer<typeof ReorderedStyleSchema>;
export type VariantCreationData = z.infer<typeof VariantCreationSchema>;
export type VariantPriceUpdateData = z.infer<typeof VariantPriceUpdateSchema>;
export type VariantDeletionData = z.infer<typeof VariantDeletionSchema>;
export type VariantCreationActionData = z.infer<typeof VariantCreationActionSchema>;