/**
 * Product data API client for storefront PDP
 * Fetches AI generation settings and available styles for a product
 */

export interface ProductStyle {
  id: string;
  name: string;
  promptTemplate: string;
  exampleImageUrl: string | null;
  order: number;
}

export interface ProductSize {
  id: string;
  name: string;
  widthPx: number;
  heightPx: number;
  sortOrder: number | null;
}

export interface VariantDimensions {
  variantId: string;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface ProductData {
  enabled: boolean;
  product?: {
    id: number;
    title: string;
    uuid: string;
  };
  styles?: ProductStyle[];
  sizes?: ProductSize[];
  variants?: VariantDimensions[];
  config?: {
    totalStyles: number;
    totalSizes: number;
    lastUpdated: string;
  };
  message?: string;
  error?: string;
}

export class ProductDataAPI {
  private shop: string;
  private baseUrl: string;

  constructor(shop: string) {
    this.shop = shop;
    this.baseUrl = `/tools/ai-studio/api/product`;
  }

  /**
   * Fetch product data for AI generation
   * @param productId - Shopify product ID
   * @returns Product data with AI generation settings
   */
  async getProductData(productId: string | number): Promise<ProductData> {
    try {
      const url = `${this.baseUrl}/${productId}?shop=${this.shop}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching product data:', error);
      return {
        enabled: false,
        error: error instanceof Error ? error.message : 'Failed to fetch product data',
      };
    }
  }

  /**
   * Check if AI generation is enabled for a product (lightweight check)
   * @param productId - Shopify product ID
   * @returns Boolean indicating if AI generation is enabled
   */
  async isAIEnabled(productId: string | number): Promise<boolean> {
    try {
      const data = await this.getProductData(productId);
      return data.enabled && (data.styles?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking AI enablement:', error);
      return false;
    }
  }

  /**
   * Get available styles for a product
   * @param productId - Shopify product ID
   * @returns Array of available AI styles
   */
  async getAvailableStyles(productId: string | number): Promise<ProductStyle[]> {
    try {
      const data = await this.getProductData(productId);
      return data.styles || [];
    } catch (error) {
      console.error('Error fetching styles:', error);
      return [];
    }
  }

  /**
   * Get available sizes for a product
   * @param productId - Shopify product ID
   * @returns Array of available sizes
   */
  async getAvailableSizes(productId: string | number): Promise<ProductSize[]> {
    try {
      const data = await this.getProductData(productId);
      return data.sizes || [];
    } catch (error) {
      console.error('Error fetching sizes:', error);
      return [];
    }
  }
}

// Utility function to create API instance
export function createProductDataAPI(shop?: string): ProductDataAPI {
  // Try to get shop from window.Shopify if not provided
  const shopDomain = shop ||
    (typeof window !== 'undefined' && (window as any).Shopify?.shop) ||
    '';

  if (!shopDomain) {
    throw new Error('Shop domain is required. Please provide it or ensure window.Shopify.shop is available.');
  }

  return new ProductDataAPI(shopDomain);
}

// Example usage in PDP
export async function loadProductDataForPDP(productId: string | number) {
  try {
    const api = createProductDataAPI();
    const data = await api.getProductData(productId);

    if (data.enabled) {
      console.log('AI Generation is enabled for this product');
      console.log('Available styles:', data.styles);
      console.log('Available sizes:', data.sizes);

      // Show AI generation UI
      return data;
    } else {
      console.log('AI Generation is not enabled for this product');
      return null;
    }
  } catch (error) {
    console.error('Failed to load product data:', error);
    return null;
  }
}
