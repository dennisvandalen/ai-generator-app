import { z } from "zod";

export const ProductBaseVariantSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Variant name is required").max(255, "Variant name must be 255 characters or less"),
  widthPx: z.number().min(1, "Width must be at least 1 pixel"),
  heightPx: z.number().min(1, "Height must be at least 1 pixel"),
  price: z.number().min(0, "Price must be 0 or greater"),
  compareAtPrice: z.number().min(0, "Compare at price must be 0 or greater").optional().nullable(),
  optionValues: z.record(z.string()).default({}),
});

export const ProductBaseFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or less"),
  description: z.string().max(1000, "Description must be 1000 characters or less").optional(),
  optionNames: z.array(z.string()).default([]),
  variants: z.array(ProductBaseVariantSchema).default([]),
});

export type ProductBaseVariantData = z.infer<typeof ProductBaseVariantSchema>;
export type ProductBaseFormData = z.infer<typeof ProductBaseFormSchema>;