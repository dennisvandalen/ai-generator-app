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
    // Cart functionality will be implemented later
  }

  injectAIPlaceholder() {
    // Don't inject if already exists
    if (document.getElementById('ai-generator-placeholder-react')) {
      return;
    }

    // Find the product form
    const productForm = findProductForm();
    if (!productForm) {
      console.log('⚠️ Product form with add to cart button not found');
      return;
    }

    console.log('✅ Found product form:', productForm.id || 'no-id', productForm);

    // Create container for React component
    const container = document.createElement('div');
    container.id = 'ai-generator-placeholder-react';
    
    // Insert before the product form
    productForm.parentNode?.insertBefore(container, productForm);

    // Render React component
    const root = createRoot(container);
    root.render(
      <AIPlaceholder
        isThemeEditor={this.isEditor}
        onGenerationToggle={this.handleGenerationToggle.bind(this)}
      />
    );

    const mode = this.isEditor ? 'theme editor notification' : 'interactive widget';
    console.log(`✅ AI React ${mode} injected above product form (${productForm.id || 'no-id'})`);
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
        '/tools/ai-studio/api/hello',
        '/tools/ai-studio/api/test-proxy',
        '/tools/ai-studio/api/secure'
      ];
      
      tests.forEach((url, index) => {
        const testName = ['hello', 'test-proxy', 'secure'][index];
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