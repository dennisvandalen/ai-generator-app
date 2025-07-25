import { z } from 'zod';

// Base schema for the form state (used for client-side validation)
export const AiStyleFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: "Style name is required" }),
  promptTemplate: z.string().min(1, { message: "Prompt template is required" }),
  exampleImageUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

// Schema for a full 'update' action (requires ID)
export const UpdateAiStyleSchema = AiStyleFormSchema.extend({
  _action: z.literal('update-style'),
  id: z.string().uuid(), // ID is now required
});

// Schema for a PARTIAL 'update' action.
// Uses .partial() to make all form fields optional.
// This is crucial for submitting only changed fields.
export const UpdatePartialAiStyleSchema = UpdateAiStyleSchema.partial();

// Schema for the 'delete' action
export const DeleteAiStyleSchema = z.object({
  _action: z.literal('delete-style'),
  id: z.string().uuid(),
});

// Type exports for type-safe usage throughout the app
export type AiStyleFormData = z.infer<typeof AiStyleFormSchema>;
