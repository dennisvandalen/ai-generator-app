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
});

// Main product settings save schema
export const ProductSettingsSchema = z.object({
  isEnabled: z.boolean(),
  selectedStyles: z.array(z.string()).default([]),
  selectedProductBases: z.array(z.string()).default([]),
  reorderedStyles: z.array(ReorderedStyleSchema).default([]),
  variantMappings: z.array(VariantMappingSchema).default([]),
});

// Comprehensive Product Form Schema for RHF
export const ProductFormSchema = z.object({
  // Core product settings
  isEnabled: z.boolean(),
  
  // AI Styles selection (array of style UUIDs)
  selectedStyles: z.array(z.string()),
  
  // Product Bases selection (array of product base UUIDs)
  selectedProductBases: z.array(z.string()),
  
  // Variant mappings (maps product base variants to Shopify variants)
  variantMappings: z.array(VariantMappingSchema),
  
  // Style reordering (automatically computed from selectedStyles order)
  reorderedStyles: z.array(ReorderedStyleSchema),
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

// Schema for bulk variant deletion
export const BulkVariantDeletionSchema = z.object({
  variantIds: z.array(z.string()),
});

// Schema for variant creation action
export const VariantCreationActionSchema = z.object({
  variantsToCreate: z.array(VariantCreationSchema),
});

// Schema for bulk variant creation action
export const BulkVariantCreationActionSchema = z.object({
  productBaseVariantIds: z.array(z.number()),
});

// Schema for sync operation
export const SyncVariantsSchema = z.object({
  createMissing: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
  removeOrphaned: z.boolean().default(false),
});

// Export types
export type ProductSettingsData = z.infer<typeof ProductSettingsSchema>;
export type ProductFormData = z.infer<typeof ProductFormSchema>;
export type VariantMappingData = z.infer<typeof VariantMappingSchema>;
export type ReorderedStyleData = z.infer<typeof ReorderedStyleSchema>;
export type VariantCreationData = z.infer<typeof VariantCreationSchema>;
export type VariantPriceUpdateData = z.infer<typeof VariantPriceUpdateSchema>;
export type VariantDeletionData = z.infer<typeof VariantDeletionSchema>;
export type BulkVariantDeletionData = z.infer<typeof BulkVariantDeletionSchema>;
export type VariantCreationActionData = z.infer<typeof VariantCreationActionSchema>;
export type BulkVariantCreationActionData = z.infer<typeof BulkVariantCreationActionSchema>;
export type SyncVariantsData = z.infer<typeof SyncVariantsSchema>;