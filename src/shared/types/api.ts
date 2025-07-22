/**
 * Shared API Types for AI Generator SDK
 * Used by both frontend and backend
 */

export interface AIStyle {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  enabled: boolean;
}

export interface GenerationRequest {
  productId: string;
  styleId: string;
  uploadedImageUrl: string;
  variantId?: string;
  customerId?: string;
  customerEmail?: string;
}

export interface Generation {
  id: string;
  productId: string;
  styleId: string;
  customerId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  originalImageUrl: string;
  generatedImageUrl?: string;
  previewImageUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface GenerationResponse {
  success: boolean;
  generation?: Generation;
  error?: string;
}

export interface ProductStylesResponse {
  success: boolean;
  styles: AIStyle[];
  error?: string;
}

export interface AppProxyResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} 