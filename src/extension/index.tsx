import {createRoot} from 'react-dom/client';
import {AIGeneratorAPI} from './api/client';
import {isProductPage, getPageType, isThemeEditor} from './utils/pageDetection';
import {
  findProductForm,
  updateGenerationState,
  generateUUID,
  createButtonsOverlay,
  addHiddenFields
} from './utils/formDetection';
import {isDebugMode, debugLog, debugError} from './utils/debug';
import {AIPlaceholder} from './components/AIPlaceholder';
import {DebugPanel} from './components/DebugPanel';
import {ProductAIGenerator} from './components/ProductAIGenerator';
import type {ProductStyle} from '@shared/api/productData';

// Type definitions
interface AIConverterData {
  aiEnabled?: boolean;
  productId?: string;
  productTitle?: string;
  shopDomain?: string;
  enableForAllPages?: boolean;
  enableOnCart?: boolean;
  enableOnCollection?: boolean;
  lastUpdated?: string;
}

interface AIGenerationState {
  generationSelected: boolean;
  generationId: string | null;
  isInitialized: boolean;
}

interface CartItem {
  key: string;
  variant_id: number;
  product_title: string;
  variant_title: string;
  properties?: {
    _ai_generated_image?: string;
    [key: string]: string | undefined;
  };
}

interface CartData {
  items: CartItem[];
}

declare global {
  interface Window {
    __aiConverterV1?: AIConverterData;
    __aiGenerationState?: AIGenerationState;
    aiGeneratorSDK?: AIGeneratorSDK;
    __testAppProxy?: () => void;
  }
}

/**
 * Main AI Generator SDK Class
 * Simple App Proxy-only architecture
 */
class AIGeneratorSDK {
  private api: AIGeneratorAPI;
  private isEditor: boolean;
  private aiConverterData: AIConverterData;
  private pageType: string;

  constructor() {
    this.api = new AIGeneratorAPI();
    this.isEditor = isThemeEditor();
    this.pageType = getPageType();
    this.aiConverterData = window.__aiConverterV1 || {};

    // Initialize generation state on window
    window.__aiGenerationState = {
      generationSelected: false,
      generationId: null,
      isInitialized: false
    };

    debugLog('🎨 AI Generator SDK initializing...', {
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

    // Initialize cart drawer watcher on all pages (cart drawer can appear anywhere)
    this.initCartDrawerWatcher();

    // Add debug panel if debug mode is enabled and there's relevant data
    if (isDebugMode() && (this.aiConverterData.productId || this.pageType === 'product' || this.aiConverterData.enableForAllPages)) {
      this.showDebugPanel();
    }

    // Store globally for external access
    window.aiGeneratorSDK = this;
    window.dispatchEvent(new CustomEvent('aiGeneratorReady', {
      detail: {sdk: this}
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
    debugLog('🎨 Initializing product page features...');

    // Wait a bit for the page to fully load
    setTimeout(() => {
      this.injectAIPlaceholder();

      // Only add interactive features on live store
      if (!this.isEditor) {
        // Get current state from window
        const currentState = window.__aiGenerationState;

        // Add hidden fields to form if state exists
        if (currentState) {
          addHiddenFields(currentState);
        }

        // Create initial overlay (no generation selected yet)
        createButtonsOverlay();

        // Mark as initialized
        if (window.__aiGenerationState) {
          window.__aiGenerationState.isInitialized = true;
        }

        debugLog('✅ AI generation functionality initialized (interactive mode)');
      } else {
        debugLog('✅ AI notification displayed (theme editor preview mode)');
      }
    }, 500);
  }

  async initCartPage() {
    debugLog('🛒 Initializing cart page features...');
    // Initial update
    this.updateCartImages();

    // Watch for cart changes in different cart implementations

    // 1. Original cart structure - #main-cart-items
    const cartItemsNode = document.getElementById('main-cart-items');
    if (cartItemsNode) {
      debugLog('✅ Attaching MutationObserver to #main-cart-items');
      const observer = new MutationObserver((mutationsList: MutationRecord[]) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            debugLog('🛒 MutationObserver: Child list changed in #main-cart-items, triggering image update.');
            this.updateCartImages();
          }
        }
      });

      observer.observe(cartItemsNode, {childList: true, subtree: true});
    } else {
      debugLog('⚠️ #main-cart-items not found, looking for alternative cart structures.');
    }

    // 2. New table-based cart structure - .cart-items__table
    const cartItemsTable = document.querySelector('.cart-items__table');
    if (cartItemsTable) {
      debugLog('✅ Attaching MutationObserver to .cart-items__table');
      const tableObserver = new MutationObserver((mutationsList: MutationRecord[]) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            debugLog('🛒 MutationObserver: Child list changed in .cart-items__table, triggering image update.');
            this.updateCartImages();
          }
        }
      });

      tableObserver.observe(cartItemsTable, {childList: true, subtree: true});
    }

    // 3. General cart form - #cart-form or form.cart-form
    const cartForm = document.getElementById('cart-form') || document.querySelector('form.cart-form');
    if (cartForm) {
      debugLog('✅ Attaching MutationObserver to cart form');
      const formObserver = new MutationObserver((mutationsList: MutationRecord[]) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            debugLog('🛒 MutationObserver: Child list changed in cart form, triggering image update.');
            this.updateCartImages();
          }
        }
      });

      formObserver.observe(cartForm, {childList: true, subtree: true});
    }

    // If none of the specific cart elements were found, observe the entire cart page as a fallback
    if (!cartItemsNode && !cartItemsTable && !cartForm) {
      const cartPage = document.querySelector('.cart-page, .page-cart, #cart, [data-cart-wrapper]');
      if (cartPage) {
        debugLog('✅ Attaching MutationObserver to general cart page element as fallback');
        const pageObserver = new MutationObserver((mutationsList: MutationRecord[]) => {
          for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
              debugLog('🛒 MutationObserver: Child list changed in cart page, triggering image update.');
              this.updateCartImages();
            }
          }
        });

        pageObserver.observe(cartPage, {childList: true, subtree: true});
      } else {
        debugLog('⚠️ No cart elements found for observation. Will rely on initial update only.');
      }
    }
  }

  initCartNotificationWatcher() {
    debugLog('🛒 Initializing cart notification watcher...');

    // Watch for cart notification appearance
    const observer = new MutationObserver((mutationsList: MutationRecord[]) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          // Check if cart notification was added
          const cartNotification = document.querySelector('#cart-notification');
          if (cartNotification && cartNotification.classList.contains('active')) {
            debugLog('🛒 Cart notification appeared, updating images...');
            // Small delay to ensure the notification is fully rendered
            setTimeout(() => this.updateCartImages(), 100);
          }
        }
      }
    });

    // Watch the entire document body for cart notification changes
    observer.observe(document.body, {childList: true, subtree: true});

    // Also watch for cart notification visibility changes
    const cartNotification = document.querySelector('#cart-notification');
    if (cartNotification) {
      const visibilityObserver = new MutationObserver((mutationsList: MutationRecord[]) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target as HTMLElement;
            if (target.classList.contains('active')) {
              debugLog('🛒 Cart notification became active, updating images...');
              setTimeout(() => this.updateCartImages(), 100);
            }
          }
        }
      });

      visibilityObserver.observe(cartNotification, {attributes: true, attributeFilter: ['class']});
    }
  }

  initCartDrawerWatcher() {
    debugLog('🛒 Initializing cart drawer watcher...');

    // Watch for cart drawer appearance
    const observer = new MutationObserver((mutationsList: MutationRecord[]) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          // Check if cart drawer was added or modified
          const cartDrawer = document.querySelector('.cart-drawer-component, .cart-drawer__dialog');
          if (cartDrawer) {
            debugLog('🛒 Cart drawer detected, updating images...');
            // Small delay to ensure the drawer is fully rendered
            setTimeout(() => this.updateCartImages(), 100);
          }
        }
      }
    });

    // Watch the entire document body for cart drawer changes
    observer.observe(document.body, {childList: true, subtree: true});

    // Also watch for cart drawer visibility changes if it already exists
    const cartDrawer = document.querySelector('.cart-drawer-component, .cart-drawer__dialog');
    if (cartDrawer) {
      debugLog('🛒 Cart drawer already exists, setting up visibility observer...');

      const visibilityObserver = new MutationObserver((mutationsList: MutationRecord[]) => {
        for (const mutation of mutationsList) {
          // Check for attribute changes (like open/closed state)
          if (mutation.type === 'attributes') {
            const target = mutation.target as HTMLElement;

            // For dialog elements, check the 'open' attribute
            if (target.tagName === 'DIALOG' && target.hasAttribute('open')) {
              debugLog('🛒 Cart drawer dialog opened, updating images...');
              setTimeout(() => this.updateCartImages(), 100);
            }

            // For other elements, check for class changes
            else if (mutation.attributeName === 'class') {
              // Different drawer implementations might use different classes
              if (target.classList.contains('active') ||
                  target.classList.contains('open') ||
                  target.classList.contains('visible')) {
                debugLog('🛒 Cart drawer became visible, updating images...');
                setTimeout(() => this.updateCartImages(), 100);
              }
            }
          }
        }
      });

      // Observe both attribute and child changes
      visibilityObserver.observe(cartDrawer, {
        attributes: true,
        childList: true,
        subtree: true
      });

      // Also observe the cart drawer content specifically
      const cartDrawerContent = cartDrawer.querySelector('.cart-drawer__content, .cart-items__table');
      if (cartDrawerContent) {
        debugLog('🛒 Setting up observer for cart drawer content...');
        const contentObserver = new MutationObserver((_mutationsList: MutationRecord[]) => {
          debugLog('🛒 Cart drawer content changed, updating images...');
          setTimeout(() => this.updateCartImages(), 100);
        });

        contentObserver.observe(cartDrawerContent, {
          childList: true,
          subtree: true
        });
      }
    }
  }

  async updateCartImages(cart: CartData | null = null) {
    try {
      const cartData: CartData = cart || await (await fetch('/cart.js')).json();
      debugLog('🛒 updateCartImages: Received cart data:', cartData);
      if (!cartData || !cartData.items) {
        debugLog('🛒 updateCartImages: No cart data or items found.');
        return;
      }

      // First, handle cart notification separately to avoid conflicts
      this.updateCartNotificationImage(cartData);

      // Filter items that have AI-generated images
      const aiGeneratedItems = cartData.items.filter((item: CartItem) =>
        item.properties && item.properties._ai_generated_image
      );

      debugLog('🛒 updateCartImages: Found', aiGeneratedItems.length, 'items with AI-generated images out of', cartData.items.length, 'total items');

      // REVERSED APPROACH: Loop through HTML elements first, then match with cart data

      // 1. Handle original cart structure
      const cartItemRows = document.querySelectorAll('.cart-item') as NodeListOf<HTMLElement>;
      cartItemRows.forEach((row) => {
        // Find product link in this row
        const productLink = row.querySelector('a[href*="/products/"]');
        if (productLink) {
          const href = productLink.getAttribute('href');
          if (href) {
            // Try to find a matching item in the cart data
            const matchingItem = cartData.items.find((item: CartItem) =>
              href.includes(item.key) && item.properties && item.properties._ai_generated_image
            );

            if (matchingItem && matchingItem.properties?._ai_generated_image) {
              const aiImageUrl = matchingItem.properties._ai_generated_image;
              debugLog('🛒 updateCartImages: Found matching item for row with href:', href, 'item key:', matchingItem.key);

              // Update the image
              const imgElement = row.querySelector('.cart-item__image') as HTMLImageElement;
              if (imgElement) {
                debugLog('🛒 updateCartImages: Found image element within row, updating to:', aiImageUrl);
                imgElement.setAttribute('src', aiImageUrl);
                debugLog('🛒 updateCartImages: Main cart image src updated for item', matchingItem.key, 'to:', aiImageUrl);
              }
            }
          }
        }
      });

      // 2. Handle new table structure
      const cartItemsTableRows = document.querySelectorAll('.cart-items__table-row') as NodeListOf<HTMLElement>;
      cartItemsTableRows.forEach((row, index) => {
        // Find all product links in this row
        const links = row.querySelectorAll('a[href*="/products/"]');
        if (links.length === 0) {
          debugLog('🛒 updateCartImages: No product links found in row', index);
          return;
        }

        // Try to find a matching item in the cart data
        let matchingItem = null;

        // Method 1: Try to match by exact key in the URL
        for (const link of Array.from(links)) {
          const href = link.getAttribute('href');
          if (href) {
            // Check each AI-generated item to see if its key is in the URL
            for (const item of aiGeneratedItems) {
              if (href.includes(item.key)) {
                matchingItem = item;
                debugLog('🛒 updateCartImages: Found exact key match in link:', href, 'for item key:', item.key);
                break;
              }
            }

            if (matchingItem) break;
          }
        }

        // Method 2: If no exact match found, try to match by variant ID
        if (!matchingItem) {
          for (const link of Array.from(links)) {
            const href = link.getAttribute('href');
            if (href) {
              // Extract variant ID from URL (usually in the format /products/product-handle?variant=12345)
              const variantMatch = href.match(/variant=(\d+)/);
              if (variantMatch && variantMatch[1]) {
                const variantId = variantMatch[1];

                // Find matching item by variant ID
                const matchingItemByVariant = aiGeneratedItems.find((item: CartItem) =>
                  item.variant_id.toString() === variantId
                );

                if (matchingItemByVariant) {
                  matchingItem = matchingItemByVariant;
                  debugLog('🛒 updateCartImages: Found variant ID match in link:', href, 'for item variant ID:', variantId);
                  break;
                }
              }
            }
          }
        }

        // If we found a matching item, update the image
        if (matchingItem && matchingItem.properties?._ai_generated_image) {
          const aiImageUrl = matchingItem.properties._ai_generated_image;
          debugLog('🛒 updateCartImages: Found matching item for row', index, 'item key:', matchingItem.key);

          // Find the image in the media cell
          const mediaCell = row.querySelector('.cart-items__media');
          if (mediaCell) {
            // Standard image element
            const imgElement = mediaCell.querySelector('img') as HTMLImageElement;
            if (imgElement) {
              debugLog('🛒 updateCartImages: Found image element within table row, updating to:', aiImageUrl);
              imgElement.setAttribute('src', aiImageUrl);

              // Also update the srcset if it exists
              if (imgElement.hasAttribute('srcset')) {
                imgElement.setAttribute('srcset', `${aiImageUrl} 250w`);
              }

              debugLog('🛒 updateCartImages: Cart table image src updated for item', matchingItem.key, 'to:', aiImageUrl);
            } else {
              debugLog('🛒 updateCartImages: Could not find image element within table row');
            }
          } else {
            debugLog('🛒 updateCartImages: Could not find media cell within table row');
          }
        } else {
          debugLog('🛒 updateCartImages: No matching AI-generated item found for row', index);
        }
      });

      // 3. Update any other cart-related images (like mini cart, drawer cart, etc.)
      const allCartContainers = document.querySelectorAll('[data-cart-item], .cart-item, .cart-drawer-item, .mini-cart-item, .cart-items__media-container');
      allCartContainers.forEach((container) => {
        // Find product links in this container
        const links = container.querySelectorAll('a[href*="/products/"]');
        if (links.length === 0) return;

        // Try to find a matching item in the cart data
        let matchingItem = null;

        for (const link of Array.from(links)) {
          const href = link.getAttribute('href');
          if (href) {
            // Check each AI-generated item to see if its key is in the URL
            for (const item of aiGeneratedItems) {
              if (href.includes(item.key) || href.includes(item.variant_id.toString())) {
                matchingItem = item;
                break;
              }
            }

            if (matchingItem) break;
          }
        }

        // If we found a matching item, update the image
        if (matchingItem && matchingItem.properties?._ai_generated_image) {
          const aiImageUrl = matchingItem.properties._ai_generated_image;

          // Find and update all images in this container
          const images = container.querySelectorAll('img[src*="cdn/shop"], img[src*="myshopify"]') as NodeListOf<HTMLImageElement>;
          images.forEach((img) => {
            debugLog('🛒 updateCartImages: Found additional cart image for item key:', matchingItem.key, img);
            img.setAttribute('src', aiImageUrl);

            // Also update the srcset if it exists
            if (img.hasAttribute('srcset')) {
              img.setAttribute('srcset', `${aiImageUrl} 250w`);
            }

            debugLog('🛒 updateCartImages: Additional cart image src updated for item', matchingItem.key, 'to:', aiImageUrl);
          });
        }
      });

    } catch (error) {
      debugError('Error updating cart images:', error);
    }
  }

  updateCartNotificationImage(cartData: CartData) {
    debugLog('🛒 updateCartNotificationImage: Processing cart notification...');

    const cartNotificationProduct = document.querySelector('#cart-notification-product') as HTMLElement;
    if (!cartNotificationProduct) {
      debugLog('🛒 updateCartNotificationImage: No cart notification product found.');
      return;
    }

    // Try to identify which item the cart notification is showing
    // Method 1: Check the product name in the notification
    const notificationProductName = cartNotificationProduct.querySelector('.cart-notification-product__name')?.textContent?.trim();
    debugLog('🛒 updateCartNotificationImage: Notification product name:', notificationProductName);

    // Method 2: Check if there's a specific item key or variant ID in the notification
    const notificationImgElement = cartNotificationProduct.querySelector('img') as HTMLImageElement;
    if (!notificationImgElement) {
      debugLog('🛒 updateCartNotificationImage: No notification image element found.');
      return;
    }

    // Find the most recently added item with AI generation
    // Cart notifications typically show the most recently added item
    const aiGeneratedItems = cartData.items.filter((item: CartItem) =>
      item.properties && item.properties._ai_generated_image
    );

    if (aiGeneratedItems.length === 0) {
      debugLog('🛒 updateCartNotificationImage: No AI generated items found in cart.');
      return;
    }

    // Get the most recent AI generated item (last in the array)
    const mostRecentAiItem = aiGeneratedItems[aiGeneratedItems.length - 1];
    const aiImageUrl = mostRecentAiItem.properties?._ai_generated_image;

    if (!aiImageUrl) {
      debugLog('🛒 updateCartNotificationImage: No AI image URL found for most recent item.');
      return;
    }

    debugLog('🛒 updateCartNotificationImage: Most recent AI item:', mostRecentAiItem.key, 'with image:', aiImageUrl);

    // Update the notification image
    notificationImgElement.setAttribute('src', aiImageUrl);
    debugLog('🛒 updateCartNotificationImage: Cart notification image updated to:', aiImageUrl);

    // Additional check: If the notification product name matches a specific item, use that instead
    if (notificationProductName) {
      const matchingItem = cartData.items.find((item: CartItem) => {
        // Try to match by product title or variant title
        const itemTitle = item.product_title || item.variant_title || '';
        return itemTitle.toLowerCase().includes(notificationProductName.toLowerCase()) ||
          notificationProductName.toLowerCase().includes(itemTitle.toLowerCase());
      });

      if (matchingItem?.properties?._ai_generated_image) {
        const matchingAiImageUrl = matchingItem.properties._ai_generated_image;
        debugLog('🛒 updateCartNotificationImage: Found matching item by name:', matchingItem.key, 'with image:', matchingAiImageUrl);
        notificationImgElement.setAttribute('src', matchingAiImageUrl);
        debugLog('🛒 updateCartNotificationImage: Cart notification image updated to matching item:', matchingAiImageUrl);
      }
    }
  }

  injectAIPlaceholder() {
    // Don't inject if already exists
    if (document.getElementById('ai-generator-placeholder-react')) {
      debugLog('AI customizer already injected, skipping.');
      return;
    }

    // Try to find the Quantity section first
    const quantitySection = document.querySelector('[id^="Quantity-Form-"]');
    debugLog('Quantity section found:', !!quantitySection, quantitySection);

    let insertBeforeElem = quantitySection;
    let insertLocation = 'Quantity section';

    // If not found, fallback to product form
    if (!quantitySection) {
      const productForm = findProductForm();
      debugLog('Product form found:', !!productForm, productForm);
      if (!productForm) {
        debugLog('⚠️ Quantity section and product form not found');
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
      debugLog('⚠️ Insert target element is null, cannot inject AI customizer');
      return;
    }
    debugLog('Inserting AI customizer before:', insertBeforeElem);
    insertBeforeElem.parentNode?.insertBefore(container, insertBeforeElem);

    // Get productId and shop from window metafield if available
    const aiConverterData = window.__aiConverterV1 || {};
    const productId = aiConverterData.productId;
    const shop = aiConverterData.shopDomain;

    // Render React component
    const root = createRoot(container);
    root.render(
      <>
        {this.isEditor && (
          <AIPlaceholder
            isThemeEditor={this.isEditor}
            productId={productId}
            shop={shop}
          />
        )}
        {this.pageType === 'product' && productId && !this.isEditor && (
          <ProductAIGenerator
            productId={productId}
            shop={shop}
            onGenerationStart={(style: ProductStyle, selectedImageUrl: string) => {
              // You can add logic here to handle when generation starts
              debugLog('AI Generation started with style:', style, 'and size:', selectedImageUrl);
            }}
            onError={(error: unknown) => {
              debugError('AI Generator error:', error);
            }}
            onUpdateGenerationState={(generationSelected, generationId, imageUrl) =>
              updateGenerationState(generationSelected, generationId, imageUrl)
            }
          />
        )}
      </>
    );

    const mode = this.isEditor ? 'theme editor notification' : 'interactive widget';
    debugLog(`✅ AI React ${mode} injected above ${insertLocation}`);
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
    const currentState = window.__aiGenerationState;
    if (!currentState) return;

    if (currentState.generationSelected) {
      // Reset state (change generation)
      updateGenerationState(false, null);
      debugLog('🔄 Generation reset - user can select new style');
    } else {
      // Simulate generation selection
      const fakeGenerationId = generateUUID();
      updateGenerationState(true, fakeGenerationId);
      debugLog('🎨 Fake generation selected:', fakeGenerationId);
    }

    // No need to manually re-render - components will detect the window state change
  }

  testAppProxy() {
    // Test app proxy connection (debug utility)
    window.__testAppProxy = () => {
      const tests = [
        '/tools/autopictura/api/test-proxy',
      ];

      tests.forEach((url, index) => {
        const testName = ['test-proxy'][index];
        debugLog(`Testing ${testName} at:`, url);

        fetch(url)
          .then(res => res.json())
          .then(data => {
            debugLog(`${testName} result:`, data);
            (window as any)[`__${testName.replace('-', '')}Result`] = data;
          })
          .catch(err => {
            debugError(`${testName} failed:`, err);
            (window as any)[`__${testName.replace('-', '')}Result`] = {error: err.message};
          });
      });
    };

    // Auto-test proxy on load
    setTimeout(() => window.__testAppProxy?.(), 1000);
  }

  logInitializationStatus() {
    debugLog('=== AI Generator Debug Info ===');
    debugLog('Theme Editor Mode:', this.isEditor);
    debugLog('Product ID:', this.aiConverterData.productId);
    debugLog('Product Title:', this.aiConverterData.productTitle);
    debugLog('AI Enabled:', this.aiConverterData.aiEnabled);
    debugLog('Page Type:', this.pageType);
    debugLog('Full Data:', this.aiConverterData);

    const shouldShowAI = this.shouldShowAI() && isProductPage();

    if (shouldShowAI) {
      if (this.isEditor && !this.aiConverterData.aiEnabled) {
        debugLog('%c🎨 AI GENERATION ENABLED (THEME EDITOR DEMO) 🎨', 'color: #ffa500; font-size: 16px; font-weight: bold;');
      } else {
        debugLog('%c🎨 AI GENERATION ENABLED FOR THIS PRODUCT! 🎨', 'color: #00ff88; font-size: 16px; font-weight: bold;');
      }
    } else if (this.aiConverterData.aiEnabled === false && isProductPage()) {
      debugLog('%c❌ AI Generation is DISABLED for this product', 'color: #ff4757; font-size: 14px; font-weight: bold;');
    }
  }

  // Public API methods
  async getProductStyles(productId: string) {
    return this.api.getProductStyles(productId);
  }

  async createGeneration(generationData: unknown) {
    return this.api.createGeneration(generationData);
  }
}

// Auto-initialize
function initializeSDK(): void {
  if (window.__aiConverterV1) {
    const sdk = new AIGeneratorSDK();
    sdk.init().catch(debugError);
  } else {
    debugLog('⚠️ AI Generator SDK: No metafield data found, skipping initialization');
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


export {AIGeneratorSDK};
