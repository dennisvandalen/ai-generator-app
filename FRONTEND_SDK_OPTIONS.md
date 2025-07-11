# Frontend SDK & Communication Strategy Options

## Current State Analysis

### Backend App (Remix)
- **Framework**: Remix with TypeScript, Drizzle ORM, SQLite
- **Routes**: Products, generations, styles, analytics, settings
- **Authentication**: Shopify OAuth with session storage
- **Data**: Comprehensive schema with shops, products, generations, styles, etc.
- **API Pattern**: Currently using Remix loaders/actions (admin app only)

### Frontend (Theme Extension)
- **Current SDK**: Placeholder JavaScript (`ai-generator.js`) with basic structure
- **Data Communication**: Shopify metafields (`__aiConverterV1` namespace)
- **Build System**: None - direct vanilla JavaScript
- **UI Integration**: Basic DOM manipulation, no framework

### Current Issues
1. **No build step** for theme extension → poor maintainability
2. **Limited communication** → only metafields, no real-time updates
3. **No code sharing** between backend and frontend
4. **Manual SDK distribution** → versioning and updates challenging
5. **Basic caching** → performance concerns with frequent API calls
6. **Static Liquid logic** → limited to template-based loading, no SPA support

### JavaScript vs Liquid Loading Strategy

**Current Liquid Approach (Limited):**
```liquid
{% if template contains 'product' %}
  <script src="{{ 'ai-generator-pdp.js' | asset_url }}"></script>
{% endif %}
```

**Enhanced JavaScript Approach (Flexible):**
```javascript
// SDK detects page type dynamically using same logic as block.liquid
function isProductPage() {
  const href = window.location.href;
  return (
    /.*\.shopifypreview\.com\/products_preview/.test(href) ||
    /\/products\/([A-Za-z0-9-_%]+)(\/)?/.test(href)
  );
}

// Load loaders dynamically based on page detection
if (isProductPage()) {
  await sdk.loadPDPLoader();
}
```

**Benefits of JavaScript-Based Loading:**
- **SPA Support**: Detects page changes without full reload (AJAX navigation)
- **Complex Logic**: Can check DOM elements, user state, custom conditions
- **Real-time**: Responds to dynamic page changes and user interactions
- **Cross-Theme**: Same logic works across all themes without Liquid modifications
- **Conditional Features**: Load based on product settings, user login, A/B tests
- **Performance**: Lazy load only what's needed, when it's needed

---

## 1. Frontend SDK Generation Options

### Option 1A: Shared Source SDK Build
**Approach**: Write SDK source code in the same repo, build it into the extension folder

**How It Works:**
Instead of generating code, we write the frontend SDK directly in TypeScript with React components. The SDK source lives in the same repo as the backend, sharing types and validation schemas. During build, we compile this source into a single bundle for the theme extension.

**What the SDK Includes:**
1. **API Client**: Typed functions for backend communication
2. **React Components**: Complete PDP form, generation modals, progress indicators
3. **State Management**: Shopping cart integration, generation tracking
4. **UI Library**: Reusable components for all AI generation features
5. **Cache Management**: Smart caching with invalidation strategies
6. **Shared Types**: API-specific types (not direct Drizzle schema exposure)

**Project Structure (Modular SDK):**
```
src/
  shared/
    types/
      api.ts              # Frontend API types (curated, not raw Drizzle)
      ui.ts               # UI state types
    schemas/
      validation.ts       # Shared Zod schemas
    constants.ts          # Shared constants
  
  frontend-sdk/
    core/                 # Core SDK - always loaded
      api/
        client.ts         # API client with hybrid proxy/direct support
        cache.ts          # Cache management
        websocket.ts      # Real-time updates
      utils/
        dom.ts            # DOM utilities
        shopify.ts        # Shopify helpers
        events.ts         # Event system for loaders
      index.ts            # Core SDK class
    
    loaders/              # Lazy-loaded modules
      pdp/                # Product Detail Page loader
        components/
          GeneratorForm.tsx
          StyleSelector.tsx
          ImageUpload.tsx
          PreviewModal.tsx
        hooks/
          useGeneration.ts
          useStyles.ts
        index.tsx         # PDP loader entry
      
      cart/               # Shopping Cart loader
        components/
          CartAIItems.tsx
          GenerationSummary.tsx
          ReorderButton.tsx
        hooks/
          useCartGenerations.ts
          useReorder.ts
        index.tsx         # Cart loader entry
      
      checkout/           # Checkout loader (future)
        components/
          DeliveryPreview.tsx
          CustomizationSummary.tsx
        index.tsx
      
      account/            # Customer Account loader (future)
        components/
          OrderHistory.tsx
          GenerationLibrary.tsx
        index.tsx
    
    utils/
      loader.ts           # Dynamic loader utility
    index.ts              # Main SDK with loader management
  
  extension/
    build.ts              # Build script - creates multiple bundles
```

**SDK API Client Example:**
```typescript
// src/frontend-sdk/api/client.ts
import type { AIStyle, GenerationRequest, GenerationResponse } from '@shared/types/api';
import { GenerationRequestSchema } from '@shared/schemas/validation';

export class AIGeneratorAPI {
  constructor(private config: {
    proxyBase: string;
    directBase?: string;
    authToken?: string;
  }) {}

  // Curated API - only what frontend needs, not raw Drizzle types
  async getProductStyles(productId: string): Promise<AIStyle[]> {
    const response = await fetch(`${this.config.proxyBase}/products/${productId}/styles`);
    
    if (!response.ok) {
      throw new AIGeneratorError('Failed to fetch styles', response.status);
    }
    
    return response.json();
  }

  async createGeneration(request: GenerationRequest): Promise<GenerationResponse> {
    // Validate with shared schema
    const validatedRequest = GenerationRequestSchema.parse(request);
    
    const endpoint = this.config.directBase 
      ? `${this.config.directBase}/generations`  // Direct API for real-time
      : `${this.config.proxyBase}/generations`;  // Proxy fallback
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(validatedRequest)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new AIGeneratorError(error.message, response.status, error.code);
    }
    
    return response.json();
  }
}
```

**React Components Example:**
```typescript
// src/frontend-sdk/components/ProductGenerator/GeneratorForm.tsx
import React, { useState } from 'react';
import { StyleSelector } from './StyleSelector';
import { ImageUpload } from './ImageUpload';
import { PreviewModal } from './PreviewModal';
import { useGeneration } from '../../hooks/useGeneration';
import { useStyles } from '../../hooks/useStyles';

interface GeneratorFormProps {
  productId: string;
  onAddToCart?: (generationId: string) => void;
}

export function GeneratorForm({ productId, onAddToCart }: GeneratorFormProps) {
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  
  const { styles, loading: stylesLoading } = useStyles(productId);
  const { 
    generateImage, 
    generation, 
    isGenerating, 
    error 
  } = useGeneration();

  const handleGenerate = async () => {
    if (!selectedStyleId || !uploadedImage) return;
    
    try {
      await generateImage({
        productId,
        styleId: selectedStyleId,
        imageFile: uploadedImage
      });
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  return (
    <div className="ai-generator-form">
      <h3>Transform Your Image with AI</h3>
      
      {error && (
        <div className="ai-error">
          {error.message}
        </div>
      )}
      
      <StyleSelector
        styles={styles}
        selectedId={selectedStyleId}
        onSelect={setSelectedStyleId}
        loading={stylesLoading}
      />
      
      <ImageUpload
        onUpload={setUploadedImage}
        disabled={isGenerating}
      />
      
      <button
        onClick={handleGenerate}
        disabled={!selectedStyleId || !uploadedImage || isGenerating}
        className="ai-generate-btn"
      >
        {isGenerating ? 'Generating...' : 'Generate AI Image'}
      </button>
      
      {generation && (
        <PreviewModal
          generation={generation}
          onAddToCart={onAddToCart}
          onClose={() => {/* handle close */}}
        />
      )}
    </div>
  );
}
```

**Hook Example:**
```typescript
// src/frontend-sdk/hooks/useGeneration.ts
import { useState, useCallback } from 'react';
import { useAPI } from './useAPI';
import { useWebSocket } from './useWebSocket';
import type { GenerationRequest, Generation } from '@shared/types/api';

export function useGeneration() {
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const api = useAPI();
  
  // Real-time updates via WebSocket
  useWebSocket({
    onGenerationUpdate: (data) => {
      if (data.generationId === generation?.id) {
        setGeneration(prev => prev ? { ...prev, ...data } : null);
        if (data.status === 'completed' || data.status === 'failed') {
          setIsGenerating(false);
        }
      }
    }
  });

  const generateImage = useCallback(async (request: {
    productId: string;
    styleId: string;
    imageFile: File;
  }) => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Upload image first
      const uploadedImageUrl = await api.uploadImage(request.imageFile);
      
      // Create generation
      const newGeneration = await api.createGeneration({
        productId: request.productId,
        styleId: request.styleId,
        uploadedImageUrl,
        customerId: window.Shopify?.customer?.id
      });
      
      setGeneration(newGeneration);
    } catch (err) {
      setError(err as Error);
      setIsGenerating(false);
    }
  }, [api]);

  return {
    generation,
    generateImage,
    isGenerating,
    error
  };
}
```

**Build Integration (Multiple Bundles):**
```javascript
// vite.extension.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'extensions/theme-extension/assets',
    rollupOptions: {
      input: {
        // Core SDK - always loaded
        'ai-generator-core': resolve(__dirname, 'src/frontend-sdk/core/index.ts'),
        
        // Loaders - loaded on demand
        'ai-generator-pdp': resolve(__dirname, 'src/frontend-sdk/loaders/pdp/index.tsx'),
        'ai-generator-cart': resolve(__dirname, 'src/frontend-sdk/loaders/cart/index.tsx'),
        'ai-generator-checkout': resolve(__dirname, 'src/frontend-sdk/loaders/checkout/index.tsx'),
        'ai-generator-account': resolve(__dirname, 'src/frontend-sdk/loaders/account/index.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'umd',
        globals: {}
      },
      external: [] // Bundle everything for theme compatibility
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@core': resolve(__dirname, 'src/frontend-sdk/core'),
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "dev:extension": "vite build --config vite.extension.config.js --watch",
    "build:extension": "vite build --config vite.extension.config.js",
    "deploy:extension": "npm run build:extension && shopify app deploy",
    "dev": "concurrently \"npm run dev:extension\" \"shopify app dev\""
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

**Core SDK Implementation:**
```typescript
// src/frontend-sdk/core/index.ts
import { AIGeneratorAPI } from './api/client';
import { CacheManager } from './api/cache';
import { EventEmitter } from './utils/events';
import { loadModule } from '../utils/loader';
import type { SDKConfig, LoaderType } from '@shared/types/api';

export class AIGeneratorSDK {
  private api: AIGeneratorAPI;
  private cache: CacheManager;
  private events: EventEmitter;
  private config: SDKConfig;
  private loadedModules = new Map<LoaderType, any>();

  constructor(config: SDKConfig) {
    this.config = config;
    this.api = new AIGeneratorAPI(config);
    this.cache = new CacheManager();
    this.events = new EventEmitter();
  }

  // Initialize core SDK
  async init() {
    console.log('🎨 AI Generator Core SDK initializing...');
    
      // Auto-detect page type and load appropriate loaders
  await this.autoLoadLoaders();
  
  // Set up dynamic page change detection (for SPA navigation)
  this.setupPageChangeDetection();
    
    // Expose global API
    window.aiGeneratorSDK = this;
  }

  // Auto-detect page and load relevant loaders
  private async autoLoadLoaders() {
    const pageType = this.detectPageType();
    
    switch (pageType) {
      case 'product':
        await this.loadPDPLoader();
        break;
      case 'cart':
        await this.loadCartLoader();
        break;
      case 'checkout':
        await this.loadCheckoutLoader();
        break;
      case 'account':
        await this.loadAccountLoader();
        break;
    }
  }

  // Lazy load PDP functionality
  async loadPDPLoader() {
    if (this.loadedModules.has('pdp')) return this.loadedModules.get('pdp');
    
    const pdpModule = await loadModule('ai-generator-pdp');
    const loader = new pdpModule.PDPLoader(this.api, this.cache, this.events);
    
    await loader.init();
    this.loadedModules.set('pdp', loader);
    
    console.log('📄 PDP Loader initialized');
    return loader;
  }

  // Lazy load Cart functionality
  async loadCartLoader() {
    if (this.loadedModules.has('cart')) return this.loadedModules.get('cart');
    
    const cartModule = await loadModule('ai-generator-cart');
    const loader = new cartModule.CartLoader(this.api, this.cache, this.events);
    
    await loader.init();
    this.loadedModules.set('cart', loader);
    
    console.log('🛒 Cart Loader initialized');
    return loader;
  }

  // Manual loader methods for theme developers
  async enablePDPFeatures() {
    return this.loadPDPLoader();
  }

  async enableCartFeatures() {
    return this.loadCartLoader();
  }

  // Public API methods
  async getProductStyles(productId: string) {
    return this.api.getProductStyles(productId);
  }

  async createGeneration(request: GenerationRequest) {
    return this.api.createGeneration(request);
  }

  // Enhanced page detection with same logic as block.liquid
  private detectPageType(): string {
    return this.getPageType();
  }

  // Reuse the same JavaScript logic from your block.liquid
  private getPageType(): string {
    if (/\/cart/.test(window.location.href)) return 'cart';
    if (/\/collections\/([A-Za-z0-9-_%]+)/.test(window.location.href)) return 'collection';
    if (this.isProductPage()) return 'product';
    if (window.location.pathname === '/' || window.location.pathname === '') return 'home';
    return 'other';
  }

  private isProductPage(): boolean {
    const href = window.location.href;
    return (
      /.*\.shopifypreview\.com\/products_preview/.test(href) ||
      /\/products\/([A-Za-z0-9-_%]+)(\/)?/.test(href)
    );
  }

  // Detect theme editor (same logic as block.liquid)
  private isThemeEditor(): boolean {
    // Check for theme preview domain
    if (window.location.hostname.includes('.shopifypreview.com')) return true;
    
    // Check for preview theme parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('preview_theme_id')) return true;
    
    // Check if we're in an iframe (theme editor loads site in iframe)
    if (window.top !== window.self || window.parent !== window) return true;
    
    // Check for theme editor specific parameters
    if (urlParams.has('_fd') || urlParams.has('_ab')) return true;
    
    return false;
  }

  // Set up page change detection for SPA navigation
  private setupPageChangeDetection() {
    let currentPath = window.location.pathname;
    
    // Listen for popstate (back/forward)
    window.addEventListener('popstate', () => {
      this.handlePageChange();
    });
    
    // Override pushState and replaceState for SPA detection
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.handlePageChange(), 0);
    };
    
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.handlePageChange(), 0);
    };
    
    // Listen for URL hash changes
    window.addEventListener('hashchange', () => {
      this.handlePageChange();
    });
    
    // Periodically check for URL changes (fallback)
    setInterval(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        this.handlePageChange();
      }
    }, 1000);
  }

  // Handle page changes dynamically
  private async handlePageChange() {
    const newPageType = this.detectPageType();
    console.log('🔄 Page changed, detected type:', newPageType);
    
    // Load appropriate loaders for new page
    switch (newPageType) {
      case 'product':
        await this.loadPDPLoader();
        break;
      case 'cart':
        await this.loadCartLoader();
        break;
      case 'checkout':
        await this.loadCheckoutLoader();
        break;
      case 'account':
        await this.loadAccountLoader();
        break;
    }
    
    // Emit page change event for loaders
    this.events.emit('page:changed', { 
      pageType: newPageType, 
      url: window.location.href 
    });
  }
}

// Auto-initialize core SDK
if (typeof window !== 'undefined' && window.__aiConverterV1) {
  const sdk = new AIGeneratorSDK({
    proxyBase: '/tools/ai-studio/api',
    directBase: window.__aiConverterV1.config.directEndpoint,
    authToken: window.__aiConverterV1.config.authToken,
    assetPath: '/cdn/shop/files/' // For loading additional modules
  });
  
  sdk.init();
}

export { AIGeneratorSDK };
```

**PDP Loader Example:**
```typescript
// src/frontend-sdk/loaders/pdp/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GeneratorForm } from './components/GeneratorForm';
import { StyleSelector } from './components/StyleSelector';
import type { AIGeneratorAPI, CacheManager, EventEmitter } from '@core';

export class PDPLoader {
  private api: AIGeneratorAPI;
  private cache: CacheManager;
  private events: EventEmitter;
  private roots = new Map<HTMLElement, any>();

  constructor(api: AIGeneratorAPI, cache: CacheManager, events: EventEmitter) {
    this.api = api;
    this.cache = cache;
    this.events = events;
  }

  async init() {
    // Find PDP containers and render React components
    const containers = document.querySelectorAll('[data-ai-generator-pdp]');
    
    containers.forEach(container => {
      this.renderProductGenerator(container as HTMLElement);
    });

    // Listen for dynamic content (AJAX product pages)
    this.events.on('page:product', (productId) => {
      this.handleProductPageLoad(productId);
    });
  }

  private renderProductGenerator(container: HTMLElement) {
    const productId = container.getAttribute('data-product-id');
    if (!productId) return;

    const root = createRoot(container);
    
    root.render(
      <GeneratorForm 
        productId={productId}
        api={this.api}
        onAddToCart={(generationId) => {
          this.events.emit('generation:add-to-cart', { generationId, productId });
        }}
      />
    );

    this.roots.set(container, root);
  }

  // Public methods for theme developers
  async renderStyleSelector(container: HTMLElement, productId: string) {
    const root = createRoot(container);
    const styles = await this.api.getProductStyles(productId);
    
    root.render(
      <StyleSelector 
        styles={styles}
        onSelect={(styleId) => {
          this.events.emit('style:selected', { styleId, productId });
        }}
      />
    );
  }

  // Cleanup
  destroy() {
    this.roots.forEach(root => root.unmount());
    this.roots.clear();
  }
}

// Export components for manual usage
export { GeneratorForm, StyleSelector, ImageUpload, PreviewModal } from './components';
```

**Cart Loader Example:**
```typescript
// src/frontend-sdk/loaders/cart/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CartAIItems } from './components/CartAIItems';
import { GenerationSummary } from './components/GenerationSummary';
import type { AIGeneratorAPI, CacheManager, EventEmitter } from '@core';

export class CartLoader {
  private api: AIGeneratorAPI;
  private cache: CacheManager;
  private events: EventEmitter;

  constructor(api: AIGeneratorAPI, cache: CacheManager, events: EventEmitter) {
    this.api = api;
    this.cache = cache;
    this.events = events;
  }

  async init() {
    // Find cart AI items
    const containers = document.querySelectorAll('[data-ai-generator-cart]');
    
    containers.forEach(container => {
      this.renderCartFeatures(container as HTMLElement);
    });

    // Listen for cart updates
    this.events.on('cart:updated', () => {
      this.refreshCartItems();
    });
  }

  private renderCartFeatures(container: HTMLElement) {
    const root = createRoot(container);
    
    root.render(
      <CartAIItems 
        api={this.api}
        onReorder={(generationId) => {
          this.events.emit('generation:reorder', { generationId });
        }}
      />
    );
  }

  // Public methods
  async getCartGenerations() {
    // Get AI generations from current cart
    const cartData = await fetch('/cart.js').then(r => r.json());
    const aiItems = cartData.items.filter(item => 
      item.properties && item.properties._ai_generated
    );
    
    return aiItems;
  }
}

export { CartAIItems, GenerationSummary, ReorderButton } from './components';
```

**Dynamic Loader Utility:**
```typescript
// src/frontend-sdk/utils/loader.ts
export async function loadModule(moduleName: string): Promise<any> {
  try {
    // Dynamic import with asset path resolution
    const assetPath = window.__aiConverterV1?.config?.assetPath || '/cdn/shop/files/';
    const moduleUrl = `${assetPath}${moduleName}.js`;
    
    // Load module dynamically
    const script = document.createElement('script');
    script.src = moduleUrl;
    script.async = true;
    
    return new Promise((resolve, reject) => {
      script.onload = () => {
        // Module should expose itself on window
        const module = window[`__${moduleName.replace(/-/g, '_')}`];
        if (module) {
          resolve(module);
        } else {
          reject(new Error(`Module ${moduleName} not found`));
        }
      };
      script.onerror = () => reject(new Error(`Failed to load ${moduleName}`));
      document.head.appendChild(script);
    });
  } catch (error) {
    console.error(`Failed to load module ${moduleName}:`, error);
    throw error;
  }
}
```

**Theme Integration (Multiple Loaders):**
```liquid
<!-- extensions/theme-extension/blocks/block.liquid -->

{%- comment -%}
  Core SDK is always loaded
{%- endcomment -%}
<script src="{{ 'ai-generator-core.js' | asset_url }}" defer></script>

{%- comment -%}
  Product Detail Page - only load PDP loader
{%- endcomment -%}
{% if template contains 'product' %}
  <script src="{{ 'ai-generator-pdp.js' | asset_url }}" defer></script>
  
  <div 
    data-ai-generator-pdp
    data-product-id="{{ product.id }}"
    class="ai-generator-pdp"
  >
    <!-- PDP components render here -->
  </div>
{% endif %}

{%- comment -%}
  Cart Page - only load cart loader
{%- endcomment -%}
{% if template contains 'cart' %}
  <script src="{{ 'ai-generator-cart.js' | asset_url }}" defer></script>
  
  <div 
    data-ai-generator-cart
    class="ai-generator-cart"
  >
    <!-- Cart components render here -->
  </div>
{% endif %}

{%- comment -%}
  Manual loader control for theme developers
{%- endcomment -%}
<script>
  // Theme developers can manually control loaders
  window.addEventListener('aiGeneratorReady', async (event) => {
    const sdk = event.detail.sdk;
    
    // Example: Only enable PDP features on certain products
    if ({{ product.id }} && {{ product.tags contains 'ai-enabled' }}) {
      await sdk.enablePDPFeatures();
    }
    
    // Example: Custom cart integration
    if (window.location.pathname.includes('/cart')) {
      const cartLoader = await sdk.enableCartFeatures();
      
      // Custom cart event handling
      document.addEventListener('cart:updated', () => {
        cartLoader.refreshCartItems();
      });
    }
  });
</script>
```

**Advanced JavaScript-Based Loading (Highly Flexible):**
```javascript
// Core SDK with intelligent loading
class SmartAISDK {
  async autoLoad() {
    // Always load core
    await this.loadCore();
    
    // Smart conditional loading with JavaScript logic
    if (this.isProductPage()) {
      const productData = await this.getProductData();
      
      // Only load if AI is enabled for this product
      if (productData.aiEnabled) {
        await this.loadPDPLoader();
        
        // Conditional features based on user state
        if (this.isLoggedInCustomer()) {
          await this.loadPersonalizationFeatures();
        }
        
        // A/B test different UI approaches
        if (this.shouldUseAdvancedUI()) {
          await this.loadAdvancedPDPComponents();
        }
      }
    }
    
    if (this.isCartPage()) {
      // Check if cart actually has AI items before loading
      const cartItems = await this.getCartItems();
      const hasAIItems = cartItems.some(item => item.properties?.ai_generated);
      
      if (hasAIItems) {
        await this.loadCartLoader();
      }
    }
    
    // Load collection features only for specific collections
    if (this.isCollectionPage()) {
      const collectionHandle = this.getCollectionHandle();
      const aiCollections = ['ai-enabled', 'custom-art', 'personalized'];
      
      if (aiCollections.includes(collectionHandle)) {
        await this.loadCollectionLoader();
      }
    }
    
    // Responsive loading based on device capabilities
    if (this.hasHighPerformanceDevice()) {
      await this.loadAdvancedAnimations();
    }
    
    // Time-based loading (e.g., holiday features)
    if (this.isHolidaySeason()) {
      await this.loadHolidayThemes();
    }
  }
  
  // Detect user preferences from localStorage/cookies
  shouldUseAdvancedUI() {
    return localStorage.getItem('ai_ui_preference') === 'advanced' ||
           this.isReturningCustomer();
  }
  
  // Performance-based loading
  hasHighPerformanceDevice() {
    return navigator.hardwareConcurrency >= 4 && 
           !navigator.connection?.saveData;
  }
  
  // Business logic integration
  isHolidaySeason() {
    const now = new Date();
    const month = now.getMonth();
    return month === 11 || month === 0; // December or January
  }
}
```

**Simplified Theme Integration (JavaScript Controls Everything):**
```liquid
<!-- Minimal Liquid - just load core SDK -->
<script src="{{ 'ai-generator-core.js' | asset_url }}" defer></script>

<!-- JavaScript handles all the intelligent loading -->
<script>
  window.addEventListener('aiGeneratorReady', async () => {
    // SDK automatically detects page type, user state, and loads appropriately
    await window.aiGeneratorSDK.autoLoad();
    
    // Theme developers can still override if needed
    if (window.customAIConfig) {
      await window.aiGeneratorSDK.loadCustomFeatures(window.customAIConfig);
    }
  });
</script>
```

**Package.json Scripts (Multiple Builds):**
```json
{
  "scripts": {
    "dev:extension": "vite build --config vite.extension.config.js --watch",
    "build:extension": "vite build --config vite.extension.config.js",
    "build:core": "vite build --config vite.extension.config.js --mode core",
    "build:pdp": "vite build --config vite.extension.config.js --mode pdp",
    "build:cart": "vite build --config vite.extension.config.js --mode cart",
    "deploy:extension": "npm run build:extension && shopify app deploy",
    "dev": "concurrently \"npm run dev:extension\" \"shopify app dev\""
  }
}
```

**Modular SDK Pros:**
- **Performance Optimized**: Only load what you need per page (PDP vs Cart vs Checkout)
- **Smaller Initial Bundle**: Core SDK is lightweight, features loaded on demand
- **Developer Flexibility**: Theme developers can choose which loaders to include
- **Independent Development**: Each loader can be developed and deployed separately
- **Graceful Degradation**: Core SDK works even if specific loaders fail to load
- **Caching Benefits**: Core SDK cached across all pages, loaders cached per page type
- **Type Safety**: Shared types between backend and all frontend modules
- **Event System**: Loaders can communicate through centralized event system
- **Hot Reload**: Fast development with module-specific rebuilds
- **Theme Control**: Conditional loading based on product settings or user preferences

**Modular SDK Cons:**
- **Complexity**: More complex architecture with multiple bundles
- **Network Requests**: Additional HTTP requests for lazy-loaded modules
- **Coordination**: Need to coordinate core SDK with loader versions
- **Debug Difficulty**: Issues could be in core SDK or specific loaders
- **Build Complexity**: Multiple entry points and build configurations
- **Module Loading**: Need robust error handling for failed module loads

### Option 1B: Runtime Dynamic SDK
**Approach**: SDK fetches its configuration and types from backend API at runtime

**Pros:**
- Always up-to-date with backend
- No build coordination needed
- Can adapt to shop-specific configurations
- Easier deployment and versioning

**Cons:**
- Runtime performance overhead
- Requires network requests on initialization
- More complex error handling

**Implementation:**
```javascript
// SDK initializes by fetching config
await aiSDK.init({
  shop: 'mystore.myshopify.com',
  apiVersion: 'v1'
});
```

### Option 1C: Hybrid CDN + Build Approach
**Approach**: Core SDK served from CDN, shop-specific configs built into extension

**Pros:**
- Best of both worlds - fast loading + customization
- Version management through CDN
- Shop-specific optimizations
- Better caching strategies

**Cons:**
- More complex infrastructure
- CDN management overhead

---

## 2. Frontend-Backend Communication Options

### Option 2A: Extended Metafields + API Cache Strategy
**Approach**: Enhanced metafield usage with smart caching and API endpoints

**Current Enhancement:**
```javascript
// Enhanced metafield structure
const aiData = {
  config: {
    apiEndpoint: 'https://myapp.fly.dev/api/v1',
    shopId: 'encrypted_shop_id',
    cacheBreaker: 'timestamp_or_hash'
  },
  product: {
    aiEnabled: true,
    lastUpdated: '2024-01-01T00:00:00Z',
    availableStyles: ['vintage', 'modern'],
    cacheTTL: 300 // 5 minutes
  }
};
```

**Implementation:**
- Backend API endpoints: `/api/v1/products/:id/styles`, `/api/v1/generations`
- Cache-first strategy with fallback to API
- Metafield `lastUpdated` as cache invalidation key

**Pros:**
- Minimal changes to current architecture
- Good performance with smart caching
- Fallback to API for real-time data

**Cons:**
- Still limited by metafield update frequency
- Not truly real-time

### Option 2B: Direct API Communication + JWT Auth
**Approach**: Theme extension communicates directly with backend APIs using JWT tokens

**Architecture:**
```javascript
// JWT token embedded in metafield or fetched via HMAC verification
const apiClient = new AIGeneratorAPI({
  endpoint: 'https://myapp.fly.dev/api/v1',
  shopToken: 'jwt_token_here',
  customerId: 'customer_id' // for order tracking
});

// Direct API calls
const styles = await apiClient.getAvailableStyles(productId);
const generation = await apiClient.createGeneration({
  productId,
  styleId,
  uploadedImage
});
```

**Implementation Requirements:**
- New API routes: `/api/v1/storefront/*`
- JWT token generation in backend
- CORS configuration for cross-origin requests
- Rate limiting and security measures

**Pros:**
- Real-time communication
- Rich API capabilities
- Better error handling
- Support for complex operations

**Cons:**
- Security complexity
- CORS considerations
- Higher server load

### Option 2C: WebSocket/SSE for Real-time Updates
**Approach**: WebSocket or Server-Sent Events for real-time generation status

**Implementation:**
```javascript
// WebSocket connection for real-time updates
const wsClient = new AIWebSocketClient({
  endpoint: 'wss://myapp.fly.dev/ws',
  shopId: 'shop_id',
  customerId: 'customer_id'
});

wsClient.on('generation_update', (data) => {
  updateUI(data.generationId, data.status, data.progress);
});
```

**Use Cases:**
- Real-time generation progress
- Order fulfillment notifications
- Admin app changes reflecting in storefront

**Pros:**
- True real-time communication
- Great user experience
- Efficient for status updates

**Cons:**
- Infrastructure complexity
- Connection management
- Scaling challenges

### Option 2D: Shopify App Proxy Integration
**Approach**: Use Shopify's App Proxy to route frontend requests through Shopify's infrastructure

**How App Proxy Works:**
Shopify App Proxy allows your theme extension to make requests to your backend app through Shopify's servers. Requests to `/apps/your-app/*` on the storefront are automatically proxied to your app with authentication included.

**URL Structure:**
```
Customer visits: mystore.myshopify.com/tools/ai-studio/api/products/123/styles
Shopify proxies to: your-app.fly.dev/tools/ai-studio/api/products/123/styles
```

**Implementation:**
```javascript
// Frontend theme extension - no CORS issues, same origin
const getProductStyles = async (productId) => {
  const response = await fetch(`/tools/ai-studio/api/products/${productId}/styles`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  return response.json();
};

// Backend app proxy handler
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  // Shopify automatically includes shop info in headers
  const shop = request.headers.get('X-Shopify-Shop-Domain');
  const customerId = request.headers.get('X-Shopify-Customer-Id');
  
  // No need for JWT - Shopify handles authentication
  const styles = await getAvailableStyles(shop, params.productId);
  
  return json(styles, {
    headers: {
      'Cache-Control': 'public, max-age=300', // 5 minute cache
    }
  });
};
```

**Shopify Configuration:**
```toml
# shopify.app.toml
[app_proxy]
url = "https://your-app.fly.dev"
subpath = "ai-studio"
prefix = "tools"
```

**Authentication & Context:**
Shopify automatically includes these headers in proxied requests:
- `X-Shopify-Shop-Domain`: The shop making the request
- `X-Shopify-Customer-Id`: Logged-in customer (if any)
- `X-Shopify-Customer-Tags`: Customer tags
- `X-Shopify-Product-Id`: Current product context (if on product page)

**Pros:**
- **No CORS issues**: Same-origin requests from customer perspective
- **Built-in authentication**: Shopify handles shop verification
- **Customer context**: Automatic customer ID and session info
- **Leverages Shopify CDN**: Requests can be cached by Shopify's edge network
- **Familiar patterns**: Standard HTTP requests, no custom auth logic
- **Rate limiting handled**: Shopify's rate limiting protects your backend

**Cons:**
- **Shopify rate limits**: Subject to Shopify's API rate limits
- **Latency overhead**: Extra hop through Shopify's servers
- **Limited HTTP methods**: Some restrictions on request types
- **URL structure constraints**: Must follow `/apps/your-app/*` pattern

### Option 2E: Hybrid App Proxy + Direct API
**Approach**: Use App Proxy for most requests but fallback to direct API for real-time features

**Architecture:**
This combines the best of App Proxy (2D) with Direct API (2B) for different use cases:

**App Proxy for:**
- Product data fetching
- Style configurations
- Static/cached content
- Customer order history

**Direct API for:**
- Real-time generation status
- File uploads (large images)
- WebSocket connections
- Background tasks

**Implementation:**
```javascript
class HybridAPIClient {
  constructor() {
    // App Proxy base (no auth needed)
    this.proxyBase = '/tools/ai-studio/api';
    
    // Direct API base (requires auth token from metafield)
    this.directBase = 'https://your-app.fly.dev/api/v1/storefront';
    this.authToken = this.getAuthTokenFromMetafield();
  }

  // Use App Proxy for standard requests
  async getProductStyles(productId) {
    const response = await fetch(`${this.proxyBase}/products/${productId}/styles`);
    return response.json();
  }

  // Use Direct API for real-time features
  async createGeneration(data) {
    const response = await fetch(`${this.directBase}/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // WebSocket for real-time updates (Direct API only)
  connectWebSocket() {
    return new WebSocket(`wss://your-app.fly.dev/ws?token=${this.authToken}`);
  }
}
```

**Backend Route Structure:**
```typescript
// App Proxy routes (no auth needed, shop context from headers)
app/routes/tools/ai-studio/api/
  ├── products.$id.styles.tsx      // GET /tools/ai-studio/api/products/123/styles
  ├── styles._index.tsx            // GET /tools/ai-studio/api/styles
  └── orders.$id.tsx               // GET /tools/ai-studio/api/orders/456

// Direct API routes (JWT auth required)
app/routes/api/v1/storefront/
  ├── generations.tsx              // POST /api/v1/storefront/generations
  ├── uploads.tsx                  // POST /api/v1/storefront/uploads
  └── ws.tsx                       // WebSocket endpoint
```

**Authentication Strategy:**
```javascript
// Embed JWT token in metafield for direct API access
const aiData = {
  config: {
    proxyEndpoint: '/tools/ai-studio/api',
    directEndpoint: 'https://your-app.fly.dev/api/v1/storefront',
    authToken: 'jwt_token_for_direct_api', // Short-lived, renewable
    wsEndpoint: 'wss://your-app.fly.dev/ws'
  },
  // ... other config
};
```

**Benefits of Hybrid Approach:**
- **Best performance**: App Proxy for cached data, Direct API for dynamic
- **Reliability**: App Proxy as primary, Direct API as enhancement
- **Shopify ecosystem**: Leverages Shopify's infrastructure where possible
- **Real-time capability**: Direct WebSocket when needed
- **Graceful degradation**: Works even if Direct API is down

**Drawbacks:**
- **Complexity**: Two different authentication methods
- **Token management**: JWT tokens need renewal
- **Dual maintenance**: Two API patterns to maintain

---

## 3. Caching Strategy Options

### Option 3A: Multi-Level Caching
**Implementation:**
```javascript
class CacheManager {
  constructor() {
    this.memoryCache = new Map(); // In-memory cache
    this.localStorageCache = new LocalStorageCache('ai_generator', 24 * 60 * 60 * 1000); // 24h
    this.sessionCache = new SessionCache(); // Session storage
  }

  async get(key, fetcher, options = {}) {
    // 1. Check memory cache
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // 2. Check localStorage with TTL
    const cached = this.localStorageCache.get(key);
    if (cached && !this.isExpired(cached, options.ttl)) {
      this.memoryCache.set(key, cached.data);
      return cached.data;
    }

    // 3. Fetch fresh data
    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }
}
```

**Pros:**
- Fast access for frequently used data
- Persistent across page loads
- Flexible TTL configurations

**Cons:**
- Complex cache invalidation
- Storage quota concerns

### Option 3B: ETags + Conditional Requests
**Implementation:**
```javascript
// API responses include ETags
const response = await fetch('/api/v1/products/123/styles', {
  headers: {
    'If-None-Match': storedETag
  }
});

if (response.status === 304) {
  // Use cached data
  return getCachedData(key);
}
```

**Pros:**
- Efficient bandwidth usage
- Server-controlled caching
- Standard HTTP caching

**Cons:**
- Requires backend ETag support
- Still requires network requests

### Option 3C: Cache-First with Background Refresh
**Implementation:**
```javascript
class BackgroundRefreshCache {
  async get(key, fetcher, ttl = 300000) { // 5 minutes
    const cached = this.getFromCache(key);
    
    if (cached) {
      // Return cached data immediately
      const result = cached.data;
      
      // Background refresh if stale
      if (this.isStale(cached, ttl)) {
        this.backgroundRefresh(key, fetcher);
      }
      
      return result;
    }
    
    // No cache, fetch immediately
    return await fetcher();
  }
}
```

**Pros:**
- Fast UI response
- Fresh data in background
- Good user experience

**Cons:**
- Potential inconsistency
- More complex state management

---

## 4. Build System: Vite-Based Pipeline

**Why Vite**: Fast builds, excellent TypeScript support, perfect for modern development workflows, and integrates well with Shopify's ecosystem.

### Development Setup
```javascript
// vite.extension.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: './src/extension/index.ts',
      name: 'AIGeneratorSDK',
      fileName: 'ai-generator',
      formats: ['umd'] // UMD for universal theme compatibility
    },
    outDir: 'extensions/theme-extension/assets',
    sourcemap: true, // For debugging
    rollupOptions: {
      external: [], // Bundle everything for theme extension
      output: {
        globals: {}
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev:extension": "vite build --config vite.extension.config.js --watch",
    "build:extension": "vite build --config vite.extension.config.js",
    "deploy:extension": "npm run build:extension && shopify app deploy",
    "dev": "concurrently \"npm run dev:extension\" \"shopify app dev\""
  }
}
```

### Project Structure
```
src/
  extension/
    index.ts              # Main SDK entry point
    api/
      client.ts           # API client (proxy + direct)
      cache.ts            # Caching strategies  
      websocket.ts        # WebSocket client
    ui/
      modal.ts            # Generation modal
      progress.ts         # Progress indicators
      gallery.ts          # Image gallery
    utils/
      dom.ts              # DOM utilities
      validation.ts       # Form validation
  shared/
    types/
      api.ts              # Shared API types
      product.ts          # Product types
    constants.ts          # Shared constants
    schemas/              # Zod validation schemas
```

### TypeScript Configuration
```json
// tsconfig.extension.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2018",
    "lib": ["DOM", "ES2018"],
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "paths": {
      "@shared/*": ["./src/shared/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "src/extension/**/*",
    "src/shared/**/*"
  ]
}
```

### Development Workflow
```bash
# Development with hot reload
npm run dev                 # Starts both extension build watch + Shopify dev

# Production build and deploy
npm run deploy:extension    # Build + deploy to Shopify

# Test build locally
npm run build:extension     # Just build without deploy
```

### Benefits of This Approach:
- **Fast Development**: Hot reload for theme extension changes
- **Type Safety**: Full TypeScript support with shared types
- **Modern Tooling**: Vite's excellent DX and performance
- **Shopify Integration**: Works seamlessly with `shopify app dev`
- **Code Sharing**: Easy imports from shared backend code
- **Production Ready**: Minification, source maps, optimization

---

## 5. Code Sharing Options

### Option 5A: Shared TypeScript Package
**Structure:**
```
src/
  shared/
    types/
      api.ts          # API request/response types
      product.ts      # Product-related types
      generation.ts   # Generation types
    utils/
      validation.ts   # Zod schemas
      constants.ts    # Shared constants
      cache.ts        # Cache utilities
  backend/
    routes/
    db/
  frontend/
    sdk/
    components/
```

**Implementation:**
```typescript
// src/shared/types/product.ts
export interface ProductConfig {
  id: string;
  aiEnabled: boolean;
  styles: StyleConfig[];
  lastUpdated: string;
}

// Used in backend
import { ProductConfig } from '@shared/types/product';

// Used in frontend
import { ProductConfig } from '@shared/types/product';
```

**Pros:**
- Type safety across frontend/backend
- Single source of truth
- Easy refactoring
- Consistent validation

**Cons:**
- Build complexity
- Bundle size for frontend

### Option 5B: Shared Validation Schemas
**Implementation:**
```typescript
// src/shared/schemas/generation.ts
import { z } from 'zod';

export const GenerationRequestSchema = z.object({
  productId: z.string().uuid(),
  styleId: z.string().uuid(),
  uploadedImageUrl: z.string().url(),
  customerId: z.string().optional()
});

// Backend validation
export const action = async ({ request }) => {
  const data = await request.json();
  const validated = GenerationRequestSchema.parse(data);
  // ...
};

// Frontend validation
const isValid = GenerationRequestSchema.safeParse(formData).success;
```

**Pros:**
- Consistent validation logic
- Automatic TypeScript types from schemas
- Runtime and compile-time safety

**Cons:**
- Zod bundle size in frontend
- Requires build pipeline

### Option 5C: API Contract Specification
**Implementation:**
```typescript
// src/shared/api-contract.ts
export const APIContract = {
  products: {
    getStyles: {
      path: '/api/v1/products/:productId/styles',
      method: 'GET',
      params: z.object({ productId: z.string() }),
      response: z.array(StyleSchema)
    },
    createGeneration: {
      path: '/api/v1/generations',
      method: 'POST',
      body: GenerationRequestSchema,
      response: GenerationResponseSchema
    }
  }
} as const;

// Generate TypeScript types and API client
type APIClient = ContractToClient<typeof APIContract>;
```

**Pros:**
- Clear API contract
- Automatic client generation
- Documentation from code
- Version management

**Cons:**
- Complex type gymnastics
- Learning curve
- Tooling requirements

---

## 6. Recommended Implementation Path (Simplified App Proxy-Only)

### Why App Proxy-Only Is The Right Choice

**The Reality Check**: For AI image generation, the complexity of dual APIs and WebSockets doesn't match the user value. AI generation inherently takes 15-30 seconds - users expect to wait. Real-time progress updates are nice-to-have, not must-have.

**Key Benefits**:
- **3-4 weeks faster development time**
- **Rock-solid reliability** (Shopify's proven infrastructure)
- **Zero CORS headaches** (same-origin requests)
- **Simple debugging** (standard HTTP in network tab)
- **Automatic scaling** (Shopify handles traffic spikes)
- **Built-in authentication** (Shopify headers, no JWT complexity)

### Phase 1: Core SDK Foundation (Week 1)
1. **Build System**: Implement simple Vite build pipeline outputting single bundle
2. **App Proxy Setup**: Configure Shopify App Proxy (`/tools/ai-studio/api/*`)
3. **Page Detection**: Migrate existing `block.liquid` JavaScript logic to SDK
4. **Basic UI**: Create React components for product page AI generation

### Phase 2: Product Page Features (Week 2)
1. **Style Selection**: Build UI for choosing AI styles
2. **Image Upload**: Handle customer image uploads via app proxy
3. **Generation Flow**: Complete end-to-end generation with polling
4. **Cart Integration**: Add generation metadata to cart line items

### Phase 3: Enhanced Features (Week 3)
1. **Cart Page**: Show AI generations in cart/checkout
2. **Progress Tracking**: Implement polling-based status updates
3. **Error Handling**: Graceful fallbacks and user messaging
4. **Performance**: Optimize bundle size and caching

### Phase 4: Polish & Deploy (Week 4)
1. **Theme Integration**: Seamless integration with existing themes
2. **Testing**: Cross-browser and mobile testing
3. **Documentation**: Theme developer integration guide
4. **Deployment**: Production deployment and monitoring

### Simplified Stack:
```typescript
{
  buildTool: 'vite',
  communication: 'shopify_app_proxy_only',
  realtime: 'polling_every_3_seconds',
  authentication: 'shopify_headers_automatic',
  caching: 'standard_http_cache_control',
  deployment: 'shopify_cli'
}
```

### App Proxy Architecture:
```javascript
// Single, simple API client
class AIGeneratorAPI {
  constructor() {
    this.baseURL = '/tools/ai-studio/api';
  }

  async getProductStyles(productId) {
    const response = await fetch(`${this.baseURL}/products/${productId}/styles`);
    return response.json();
  }

  async createGeneration(data) {
    const response = await fetch(`${this.baseURL}/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    return this.pollForCompletion(result.id);
  }

  async pollForCompletion(generationId) {
    return new Promise((resolve) => {
      const poll = async () => {
        const status = await fetch(`${this.baseURL}/generations/${generationId}/status`);
        const data = await status.json();
        
        if (data.completed) {
          resolve(data);
        } else {
          setTimeout(poll, 3000); // Poll every 3 seconds
        }
      };
      poll();
    });
  }
}
```

### When To Consider Advanced Options:
- **Generation times exceed 60+ seconds consistently**
- **Need true real-time collaboration features**
- **App Proxy latency becomes measurable user issue**
- **Require features Shopify infrastructure doesn't support**

**Bottom Line**: Start simple, ship fast, get user feedback. You can always add complexity later when you have real data showing it's needed.

---

## 7. Advanced Options (Complex Architectures)

> **⚠️ Warning**: These approaches add significant complexity. Only consider if you have specific requirements that the simple App Proxy-only approach cannot meet.

### Advanced Option A: Modular SDK with Lazy Loading

**When to use**: If you need different feature sets for different page types and bundle size is critical.

**Architecture**: Multiple JavaScript bundles that load dynamically based on page detection.

**Implementation**: See the detailed modular SDK implementation in Option 1A above.

**Trade-offs**:
- ✅ Optimal performance (only load what's needed)
- ✅ Independent feature development
- ❌ Complex build pipeline and coordination
- ❌ Additional network requests for modules
- ❌ Complex debugging and state management

### Advanced Option B: Hybrid App Proxy + Direct API

**When to use**: If you need real-time features while maintaining Shopify integration benefits.

**Architecture**: Use App Proxy for standard requests, Direct API for real-time/high-frequency operations.

**Implementation**: See Option 2E (Hybrid App Proxy + Direct API) above.

**Trade-offs**:
- ✅ Best of both worlds (reliability + real-time)
- ✅ Graceful degradation capabilities
- ❌ Dual authentication systems to maintain
- ❌ Complex fallback logic
- ❌ JWT token management overhead

### Advanced Option C: Full Real-time WebSocket Architecture

**When to use**: If you're building collaborative features or need sub-second updates.

**Architecture**: WebSocket connections for all real-time communication, App Proxy for API calls.

**Implementation**: See Option 2C (WebSocket/SSE) above.

**Trade-offs**:
- ✅ True real-time capabilities
- ✅ Great for collaborative features
- ❌ Infrastructure complexity (connection management)
- ❌ Scaling challenges
- ❌ Debugging complexity

### Migration Path from Simple to Advanced

If you start with the simple App Proxy-only approach and later need advanced features:

1. **Add Direct API**: Introduce direct endpoints alongside existing app proxy
2. **Add WebSocket**: Layer WebSocket on top for specific real-time features
3. **Modularize**: Split SDK into modules if bundle size becomes an issue

The simple approach provides a solid foundation that can evolve.

---

## 8. Infrastructure Considerations

### CDN Strategy
- Host SDK on Shopify CDN vs external CDN
- Version management and cache invalidation
- Geographic distribution

### Security
- JWT token management and rotation
- CORS policy configuration
- Rate limiting and DDoS protection
- Customer data privacy compliance

### Monitoring
- SDK error tracking (Sentry)
- Performance monitoring
- Usage analytics
- API endpoint monitoring

### Scalability
- Database connection pooling
- Background job processing
- CDN edge caching
- Horizontal scaling considerations

---

## Summary & Next Steps

This document provides comprehensive options for frontend SDK and communication strategies. **The simplified App Proxy-only approach is now the main recommendation** for the following reasons:

### Why App Proxy-Only Won
1. **Development Speed**: 3-4 weeks faster than complex hybrid approaches
2. **User Experience Reality**: AI generation takes 15-30 seconds - polling every 3 seconds feels responsive
3. **Reliability**: Leverages Shopify's proven infrastructure and automatic scaling  
4. **Simplicity**: One communication method, one auth system, standard HTTP debugging
5. **Future-Proof**: Can always add complexity later when you have real user data

### Your Implementation Path

**✅ Recommended: Simple App Proxy-Only SDK**
- Single JavaScript bundle (`ai-generator.js`)
- App Proxy communication (`/tools/ai-studio/api/*`)
- Polling-based status updates (3-second intervals)
- React components for UI
- 4-week development timeline

**⚠️ Advanced Options Available**: If you later need real-time collaboration, sub-second updates, or complex modular loading, the document contains detailed implementations for:
- Modular SDK with lazy loading
- Hybrid App Proxy + Direct API
- Full WebSocket architecture

### Immediate Next Steps

1. **Start with Core SDK Foundation** (Week 1 todos)
2. **Configure App Proxy** in `shopify.app.toml`
3. **Migrate existing `block.liquid` logic** to SDK structure
4. **Build React UI components** for product page

The todo list above breaks down the complete 4-week implementation into specific, actionable tasks with clear dependencies.

**Bottom Line**: Start simple, ship fast, get user feedback. You can always evolve to more complex architectures when you have real data showing they're needed. 