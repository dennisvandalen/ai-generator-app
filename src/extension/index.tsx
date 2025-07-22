import React from 'react';
import { createRoot } from 'react-dom/client';
import { AIGeneratorAPI } from './api/client';
import { isProductPage, getPageType, isThemeEditor } from './utils/pageDetection';
import {
  findProductForm,
  updateGenerationState,
  generateUUID,
  createButtonsOverlay,
  addHiddenFields
} from './utils/formDetection';
import { AIPlaceholder } from './components/AIPlaceholder';
import { DebugPanel } from './components/DebugPanel';
import { ProductAIGenerator } from './components/ProductAIGenerator';
import type { ProductStyle } from '../shared/api/productData';

/**
 * Main AI Generator SDK Class
 * Simple App Proxy-only architecture
 */
class AIGeneratorSDK {
  private api: AIGeneratorAPI;
  private isEditor: boolean;
  private aiConverterData: any;
  private pageType: string;

  constructor() {
    this.api = new AIGeneratorAPI();
    this.isEditor = isThemeEditor();
    this.pageType = getPageType();
    this.aiConverterData = (window as any).__aiConverterV1 || {};

    // Initialize generation state on window
    (window as any).__aiGenerationState = {
      generationSelected: false,
      generationId: null,
      isInitialized: false
    };

    console.log('🎨 AI Generator SDK initializing...', {
      isEditor: this.isEditor,
      pageType: this.pageType,
      aiConverterData: this.aiConverterData
    });
  }

  async init() {
    // Test app proxy connection
    this.testAppProxy();

    // Initialize based on page type
    if (this.pageType === 'product' && this.shouldShowAI()) {
      await this.initProductPage();
    } else if (this.pageType === 'cart') {
      await this.initCartPage();
    }

    // Initialize cart notification watcher on all pages (cart notifications can appear anywhere)
    this.initCartNotificationWatcher();

    // Add debug panel if there's relevant data
    if (this.aiConverterData.productId || this.pageType === 'product' || this.aiConverterData.enableForAllPages) {
      this.showDebugPanel();
    }

    // Store globally for external access
    (window as any).aiGeneratorSDK = this;
    window.dispatchEvent(new CustomEvent('aiGeneratorReady', {
      detail: { sdk: this }
    }));

    this.logInitializationStatus();
  }

  shouldShowAI(): boolean {
    // In theme editor, always show for demo
    if (this.isEditor) return true;

    // On live site, check metafield
    return this.aiConverterData?.aiEnabled === true;
  }

  async initProductPage() {
    console.log('🎨 Initializing product page features...');

    // Wait a bit for the page to fully load
    setTimeout(() => {
      this.injectAIPlaceholder();

      // Only add interactive features on live store
      if (!this.isEditor) {
        // Get current state from window
        const currentState = (window as any).__aiGenerationState;

        // Add hidden fields to form
        addHiddenFields(currentState);

        // Create initial overlay (no generation selected yet)
        createButtonsOverlay();

        // Mark as initialized
        (window as any).__aiGenerationState.isInitialized = true;

        console.log('✅ AI generation functionality initialized (interactive mode)');
      } else {
        console.log('✅ AI notification displayed (theme editor preview mode)');
      }
    }, 500);
  }

  async initCartPage() {
    console.log('🛒 Initializing cart page features...');
    // Initial update
    this.updateCartImages();

    // Watch for main cart changes
    const cartItemsNode = document.getElementById('main-cart-items');
    if (cartItemsNode) {
      console.log('✅ Attaching MutationObserver to #main-cart-items');
      const observer = new MutationObserver((mutationsList) => {
        for(let mutation of mutationsList) {
          if (mutation.type === 'childList') {
            console.log('🛒 MutationObserver: Child list changed, triggering image update.');
            this.updateCartImages();
          }
        }
      });

      observer.observe(cartItemsNode, { childList: true, subtree: true });
    } else {
      console.log('⚠️ #main-cart-items not found, MutationObserver not attached.');
    }
  }

  initCartNotificationWatcher() {
    console.log('🛒 Initializing cart notification watcher...');

    // Watch for cart notification appearance
    const observer = new MutationObserver((mutationsList) => {
      for(let mutation of mutationsList) {
        if (mutation.type === 'childList') {
          // Check if cart notification was added
          const cartNotification = document.querySelector('#cart-notification');
          if (cartNotification && cartNotification.classList.contains('active')) {
            console.log('🛒 Cart notification appeared, updating images...');
            // Small delay to ensure the notification is fully rendered
            setTimeout(() => this.updateCartImages(), 100);
          }
        }
      }
    });

    // Watch the entire document body for cart notification changes
    observer.observe(document.body, { childList: true, subtree: true });

    // Also watch for cart notification visibility changes
    const cartNotification = document.querySelector('#cart-notification');
    if (cartNotification) {
      const visibilityObserver = new MutationObserver((mutationsList) => {
        for(let mutation of mutationsList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target as HTMLElement;
            if (target.classList.contains('active')) {
              console.log('🛒 Cart notification became active, updating images...');
              setTimeout(() => this.updateCartImages(), 100);
            }
          }
        }
      });

      visibilityObserver.observe(cartNotification, { attributes: true, attributeFilter: ['class'] });
    }
  }

  async updateCartImages(cart = null) {
    try {
      const cartData = cart || await (await fetch('/cart.js')).json();
      console.log('🛒 updateCartImages: Received cart data:', cartData);
      if (!cartData || !cartData.items) {
        console.log('🛒 updateCartImages: No cart data or items found.');
        return;
      }

      // First, handle cart notification separately to avoid conflicts
      this.updateCartNotificationImage(cartData);

      // Then handle main cart page and other cart implementations
      cartData.items.forEach((item: any) => {
        console.log('🛒 updateCartImages: Processing item:', item.key, 'with properties:', item.properties);
        if (item.properties && item.properties._ai_generated_image) {
          const aiImageUrl = item.properties._ai_generated_image;
          console.log('🛒 updateCartImages: AI generated image URL for item', item.key, ':', aiImageUrl);

          // 1. Update main cart page images
          const cartItemRow = document.querySelector(`.cart-item:has(a[href*="${item.key}"])`) as HTMLElement;
          if (cartItemRow) {
            console.log('🛒 updateCartImages: Found cart item row for item key:', item.key, cartItemRow);
            const imgElement = cartItemRow.querySelector('.cart-item__image') as HTMLImageElement;
            if (imgElement) {
              console.log('🛒 updateCartImages: Found image element within row for item key:', item.key, imgElement);
              imgElement.setAttribute('src', aiImageUrl);
              console.log('🛒 updateCartImages: Main cart image src updated for item', item.key, 'to:', aiImageUrl);
            } else {
              console.log('🛒 updateCartImages: Could not find image element within row for item key:', item.key);
            }
          } else {
            console.log('🛒 updateCartImages: Could not find cart item row for item key:', item.key);
          }

          // 2. Update any other cart-related images (like mini cart, drawer cart, etc.)
          // Look for any img elements that might be cart-related and contain the item key
          const allCartImages = document.querySelectorAll('img[src*="cdn/shop"], img[src*="myshopify"]') as NodeListOf<HTMLImageElement>;
          allCartImages.forEach((img) => {
            // Check if this image is likely related to the current cart item
            // This is a fallback for other cart implementations
            const parentElement = img.closest('[data-cart-item], .cart-item, .cart-drawer-item, .mini-cart-item');
            if (parentElement && parentElement.textContent?.includes(item.key)) {
              console.log('🛒 updateCartImages: Found additional cart image for item key:', item.key, img);
              img.setAttribute('src', aiImageUrl);
              console.log('🛒 updateCartImages: Additional cart image src updated for item', item.key, 'to:', aiImageUrl);
            }
          });

        } else {
          console.log('🛒 updateCartImages: Item', item.key, 'does not have _ai_generated_image property.');
        }
      });
    } catch (error) {
      console.error('Error updating cart images:', error);
    }
  }

  updateCartNotificationImage(cartData: any) {
    console.log('🛒 updateCartNotificationImage: Processing cart notification...');

    const cartNotificationProduct = document.querySelector('#cart-notification-product') as HTMLElement;
    if (!cartNotificationProduct) {
      console.log('🛒 updateCartNotificationImage: No cart notification product found.');
      return;
    }

    // Try to identify which item the cart notification is showing
    // Method 1: Check the product name in the notification
    const notificationProductName = cartNotificationProduct.querySelector('.cart-notification-product__name')?.textContent?.trim();
    console.log('🛒 updateCartNotificationImage: Notification product name:', notificationProductName);

    // Method 2: Check if there's a specific item key or variant ID in the notification
    const notificationImgElement = cartNotificationProduct.querySelector('img') as HTMLImageElement;
    if (!notificationImgElement) {
      console.log('🛒 updateCartNotificationImage: No notification image element found.');
      return;
    }

    // Find the most recently added item with AI generation
    // Cart notifications typically show the most recently added item
    const aiGeneratedItems = cartData.items.filter((item: any) =>
      item.properties && item.properties._ai_generated_image
    );

    if (aiGeneratedItems.length === 0) {
      console.log('🛒 updateCartNotificationImage: No AI generated items found in cart.');
      return;
    }

    // Get the most recent AI generated item (last in the array)
    const mostRecentAiItem = aiGeneratedItems[aiGeneratedItems.length - 1];
    const aiImageUrl = mostRecentAiItem.properties._ai_generated_image;

    console.log('🛒 updateCartNotificationImage: Most recent AI item:', mostRecentAiItem.key, 'with image:', aiImageUrl);

    // Update the notification image
    notificationImgElement.setAttribute('src', aiImageUrl);
    console.log('🛒 updateCartNotificationImage: Cart notification image updated to:', aiImageUrl);

    // Additional check: If the notification product name matches a specific item, use that instead
    if (notificationProductName) {
      const matchingItem = cartData.items.find((item: any) => {
        // Try to match by product title or variant title
        const itemTitle = item.product_title || item.variant_title || '';
        return itemTitle.toLowerCase().includes(notificationProductName.toLowerCase()) ||
               notificationProductName.toLowerCase().includes(itemTitle.toLowerCase());
      });

      if (matchingItem && matchingItem.properties && matchingItem.properties._ai_generated_image) {
        const matchingAiImageUrl = matchingItem.properties._ai_generated_image;
        console.log('🛒 updateCartNotificationImage: Found matching item by name:', matchingItem.key, 'with image:', matchingAiImageUrl);
        notificationImgElement.setAttribute('src', matchingAiImageUrl);
        console.log('🛒 updateCartNotificationImage: Cart notification image updated to matching item:', matchingAiImageUrl);
      }
    }
  }

  injectAIPlaceholder() {
    // Don't inject if already exists
    if (document.getElementById('ai-generator-placeholder-react')) {
      console.log('AI customizer already injected, skipping.');
      return;
    }

    // Try to find the Quantity section first
    const quantitySection = document.querySelector('[id^="Quantity-Form-"]');
    console.log('Quantity section found:', !!quantitySection, quantitySection);

    let insertBeforeElem = quantitySection;
    let insertLocation = 'Quantity section';

    // If not found, fallback to product form
    if (!quantitySection) {
      const productForm = findProductForm();
      console.log('Product form found:', !!productForm, productForm);
      if (!productForm) {
        console.log('⚠️ Quantity section and product form not found');
        return;
      }
      insertBeforeElem = productForm;
      insertLocation = `product form (${productForm.id || 'no-id'})`;
    }

    // Create container for React component
    const container = document.createElement('div');
    container.id = 'ai-generator-placeholder-react';

    // Insert before the chosen element
    if (!insertBeforeElem) {
      console.warn('⚠️ Insert target element is null, cannot inject AI customizer');
      return;
    }
    console.log('Inserting AI customizer before:', insertBeforeElem);
    insertBeforeElem.parentNode?.insertBefore(container, insertBeforeElem);

    // Get productId and shop from window metafield if available
    const aiConverterData = (window as any).__aiConverterV1 || {};
    const productId = aiConverterData.productId;
    const shop = aiConverterData.shopDomain;

    // Render React component
    const root = createRoot(container);
    root.render(
      <>
        <AIPlaceholder
          isThemeEditor={this.isEditor}
          productId={productId}
          shop={shop}
        />
        <ProductAIGenerator
          productId={productId}
          shop={shop}
          onGenerationStart={(style: ProductStyle, selectedImageUrl: string) => {
            // You can add logic here to handle when generation starts
            console.log('AI Generation started with style:', style, 'and size:', selectedImageUrl);
          }}
          onError={(error: unknown) => {
            console.error('AI Generator error:', error);
          }}
          onUpdateGenerationState={(generationSelected, generationId, imageUrl) =>
            updateGenerationState(generationSelected, generationId, imageUrl)
          }
        />
      </>
    );

    const mode = this.isEditor ? 'theme editor notification' : 'interactive widget';
    console.log(`✅ AI React ${mode} injected above ${insertLocation}`);
  }

  showDebugPanel() {
    // Create container for debug panel
    const container = document.createElement('div');
    container.id = 'ai-debug-panel-react';
    document.body.appendChild(container);

    // Render React component
    const root = createRoot(container);
    root.render(
      <DebugPanel
        aiConverterData={this.aiConverterData}
        pageType={this.pageType}
        isThemeEditor={this.isEditor}
      />
    );
  }

  handleGenerationToggle() {
    const currentState = (window as any).__aiGenerationState;

    if (currentState.generationSelected) {
      // Reset state (change generation)
      updateGenerationState(false, null);
      console.log('🔄 Generation reset - user can select new style');
    } else {
      // Simulate generation selection
      const fakeGenerationId = generateUUID();
      updateGenerationState(true, fakeGenerationId);
      console.log('🎨 Fake generation selected:', fakeGenerationId);
    }

    // No need to manually re-render - components will detect the window state change
  }

  testAppProxy() {
    // Test app proxy connection (debug utility)
    (window as any).__testAppProxy = () => {
      const tests = [
        '/tools/ai-studio/api/test-proxy',
      ];

      tests.forEach((url, index) => {
        const testName = ['test-proxy'][index];
        console.log(`Testing ${testName} at:`, url);

        fetch(url)
          .then(res => res.json())
          .then(data => {
            console.log(`${testName} result:`, data);
            (window as any)[`__${testName.replace('-', '')}Result`] = data;
          })
          .catch(err => {
            console.error(`${testName} failed:`, err);
            (window as any)[`__${testName.replace('-', '')}Result`] = { error: err.message };
          });
      });
    };

    // Auto-test proxy on load
    setTimeout(() => (window as any).__testAppProxy(), 1000);
  }

  logInitializationStatus() {
    console.log('=== AI Generator Debug Info ===');
    console.log('Theme Editor Mode:', this.isEditor);
    console.log('Product ID:', this.aiConverterData.productId);
    console.log('Product Title:', this.aiConverterData.productTitle);
    console.log('AI Enabled:', this.aiConverterData.aiEnabled);
    console.log('Page Type:', this.pageType);
    console.log('Full Data:', this.aiConverterData);

    const shouldShowAI = this.shouldShowAI() && isProductPage();

    if (shouldShowAI) {
      if (this.isEditor && !this.aiConverterData.aiEnabled) {
        console.log('%c🎨 AI GENERATION ENABLED (THEME EDITOR DEMO) 🎨', 'color: #ffa500; font-size: 16px; font-weight: bold;');
      } else {
        console.log('%c🎨 AI GENERATION ENABLED FOR THIS PRODUCT! 🎨', 'color: #00ff88; font-size: 16px; font-weight: bold;');
      }
    } else if (this.aiConverterData.aiEnabled === false && isProductPage()) {
      console.log('%c❌ AI Generation is DISABLED for this product', 'color: #ff4757; font-size: 14px; font-weight: bold;');
    }
  }

  // Public API methods
  async getProductStyles(productId: string) {
    return this.api.getProductStyles(productId);
  }

  async createGeneration(generationData: any) {
    return this.api.createGeneration(generationData);
  }
}

// Auto-initialize
function initializeSDK() {
  if ((window as any).__aiConverterV1) {
    const sdk = new AIGeneratorSDK();
    sdk.init().catch(console.error);
  } else {
    console.log('⚠️ AI Generator SDK: No metafield data found, skipping initialization');
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSDK);
  } else {
    initializeSDK();
  }
}

// Type declarations for global objects
declare global {
  interface Window {
    __aiConverterV1?: {
      aiEnabled?: boolean;
      productId?: string;
      productTitle?: string;
      shopDomain?: string;
      enableForAllPages?: boolean;
      enableOnCart?: boolean;
      enableOnCollection?: boolean;
      lastUpdated?: string;
    };
    aiGeneratorSDK?: AIGeneratorSDK;
  }
}

export { AIGeneratorSDK };
