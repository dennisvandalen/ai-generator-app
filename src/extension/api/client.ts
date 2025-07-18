import type { AIStyle, GenerationRequest, Generation, ProductStylesResponse, GenerationResponse } from '@shared/types/api';
import { APP_PROXY_CONFIG, POLLING_CONFIG, GENERATION_STATUS } from '@shared/constants';

/**
 * Simple AI Generator API Client
 * App Proxy-only architecture - no authentication complexity
 */
export class AIGeneratorAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = APP_PROXY_CONFIG.BASE_PATH;
  }

  async getProductStyles(productId: string) {
    try {
      const response = await fetch(`${this.baseURL}/products/${productId}/styles`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch styles: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching product styles:', error);
      throw error;
    }
  }

  async createGeneration(data: any) {
    try {
      const response = await fetch(`${this.baseURL}/generations`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create generation: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Start polling for completion
      return this.pollForCompletion(result.id);
    } catch (error) {
      console.error('Error creating generation:', error);
      throw error;
    }
  }

  async pollForCompletion(generationId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await fetch(`${this.baseURL}/generations/${generationId}/status`);
          
          if (!response.ok) {
            throw new Error(`Failed to check status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.completed) {
            resolve(data);
          } else if (data.failed) {
            reject(new Error(data.error || 'Generation failed'));
          } else {
            // Continue polling every 3 seconds
            setTimeout(poll, 3000);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }

  // Test connection to app proxy
  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL}/hello`);
      return await response.json();
    } catch (error) {
      console.error('App proxy connection test failed:', error);
      throw error;
    }
  }

  async uploadImage(base64Image: string, filename: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseURL}/upload-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, filename }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to upload image: ${response.status}`);
      }
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  /**
   * Create an AI generation using the selected style and uploaded image URL
   * @param {Object} params - { styleId, imageUrl, ... }
   * @returns {Promise<any>} Generation result or polling promise
   */
  async createAIGeneration(params: { styleId: string; imageUrl: string; [key: string]: any }): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create AI generation: ${response.status}`);
      }
      const result = await response.json();
      // Optionally poll for completion if result.id is present (like createGeneration)
      if (result.id) {
        return this.pollForCompletion(result.id);
      }
      return result;
    } catch (error) {
      console.error('Error creating AI generation:', error);
      throw error;
    }
  }
} 