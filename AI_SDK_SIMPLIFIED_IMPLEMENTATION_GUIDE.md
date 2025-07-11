# AI Generator SDK - Simplified Implementation Guide
*App Proxy-Only Architecture*

## 🎯 Why App Proxy-Only Is The Right Choice

**The Reality Check**: For AI image generation, the complexity of dual APIs and WebSockets doesn't match the user value. AI generation inherently takes 15-30 seconds - users expect to wait. Real-time progress updates are nice-to-have, not must-have.

### Key Benefits
- **3-4 weeks faster development time**
- **Rock-solid reliability** (Shopify's proven infrastructure)
- **Zero CORS headaches** (same-origin requests)
- **Simple debugging** (standard HTTP in network tab)
- **Automatic scaling** (Shopify handles traffic spikes)
- **Built-in authentication** (Shopify headers, no JWT complexity)

### Simplified Stack
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

---

## 🏗️ Architecture Overview

### App Proxy Configuration
```toml
# shopify.app.toml
[app_proxy]
url = "https://your-app.fly.dev"
subpath = "ai-studio"
prefix = "tools"
```

**URL Structure:**
```
Customer visits: mystore.myshopify.com/tools/ai-studio/api/products/123/styles
Shopify proxies to: your-app.fly.dev/tools/ai-studio/api/products/123/styles
```

### Simple API Client Architecture
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

### Backend Route Structure
```typescript
// App Proxy routes (no auth needed, shop context from headers)
app/routes/tools/ai-studio/api/
  ├── products.$id.styles.tsx      // GET /tools/ai-studio/api/products/123/styles
  ├── styles._index.tsx            // GET /tools/ai-studio/api/styles
  ├── generations.tsx              // POST /tools/ai-studio/api/generations
  ├── generations.$id.status.tsx   // GET /tools/ai-studio/api/generations/123/status
  └── hello.tsx                    // GET /tools/ai-studio/api/hello (test endpoint)
```

### SDK Core Structure
```javascript
// Main SDK class with auto-initialization
class AIGeneratorSDK {
  constructor() {
    this.api = new AIGeneratorAPI();
    this.isEditor = this.detectThemeEditor();
  }

  async init() {
    // Reuse your exact page detection logic from block.liquid
    const pageType = this.getPageType();
    
    if (pageType === 'product' && this.shouldShowAI()) {
      await this.initProductPage();
    }
    
    if (pageType === 'cart') {
      await this.initCartPage();
    }
  }

  // Same logic as your block.liquid
  getPageType() {
    if (/\/cart/.test(window.location.href)) return 'cart';
    if (/\/collections\/([A-Za-z0-9-_%]+)/.test(window.location.href)) return 'collection';
    if (this.isProductPage()) return 'product';
    return 'other';
  }

  isProductPage() {
    const href = window.location.href;
    return (
      /.*\.shopifypreview\.com\/products_preview/.test(href) ||
      /\/products\/([A-Za-z0-9-_%]+)(\/)?/.test(href)
    );
  }

  shouldShowAI() {
    // In theme editor, always show for demo
    if (this.isEditor) return true;
    
    // On live site, check metafield
    return window.__aiConverterV1?.aiEnabled === true;
  }
}

// Auto-initialize (same pattern as your current code)
if (window.__aiConverterV1) {
  const sdk = new AIGeneratorSDK();
  sdk.init();
}
```

---

## 📅 4-Week Implementation Timeline

## Week 1: Core SDK Foundation

### 🔧 Build System & Configuration
- [✅] **setup-build-system**: Set up Vite build pipeline for single-bundle SDK targeting extensions/theme-extension/assets/
- [✅] **configure-app-proxy**: Configure Shopify App Proxy in shopify.app.toml with prefix='tools' and subpath='ai-studio'
- [ ] **create-backend-proxy-routes**: Create app/routes/tools/ai-studio/api/ directory structure with basic routes (hello, products, generations)

### 🎯 SDK Core Development  
- [ ] **migrate-page-detection-logic**: Extract isProductPage(), getPageType(), and isThemeEditor() logic from block.liquid into SDK core
- [ ] **create-sdk-core-class**: Build main AIGeneratorSDK class with auto-initialization and page type detection
- [ ] **build-simple-api-client**: Create AIGeneratorAPI class with App Proxy-only endpoints (no auth complexity)
- [ ] **test-app-proxy-connection**: Verify App Proxy routing works end-to-end from theme extension to backend

## Week 2: Product Page Features

### 🎨 UI Components
- [ ] **create-style-selector-component**: Build React component for AI style selection with product-specific styles
- [ ] **create-image-upload-component**: Build React component for customer image upload with validation and preview

### 🔄 Generation Workflow
- [ ] **implement-generation-flow**: Build complete generation workflow: upload → style selection → generation → polling for completion
- [ ] **add-polling-mechanism**: Implement polling-based status updates for generation progress (3-second intervals)
- [ ] **integrate-with-product-form**: Replace block.liquid placeholder with React-rendered AI generation UI
- [ ] **implement-cart-integration**: Add generation metadata to cart line items and create hidden form fields

## Week 3: Enhanced Features

### 🛒 Cart & Progress
- [ ] **create-cart-page-features**: Build cart page components to display AI generation info and reorder functionality
- [ ] **add-progress-indicators**: Create visual progress indicators and loading states for generation process
- [ ] **implement-error-handling**: Add comprehensive error handling with user-friendly error messages and fallbacks

### ⚡ Performance
- [ ] **optimize-bundle-size**: Optimize Vite build for minimal bundle size and efficient loading
- [ ] **add-http-caching**: Implement proper HTTP cache headers in backend routes for performance

## Week 4: Polish & Deploy

### 🧪 Testing
- [ ] **test-theme-integration**: Test SDK integration across different Shopify themes and ensure compatibility
- [ ] **mobile-responsive-testing**: Test and optimize mobile experience for AI generation workflow
- [ ] **cross-browser-testing**: Test functionality across major browsers (Chrome, Firefox, Safari, Edge)

### 📚 Documentation & Deployment
- [ ] **create-integration-docs**: Write documentation for theme developers on how to integrate the SDK
- [ ] **setup-production-deployment**: Configure production deployment pipeline and environment variables
- [ ] **setup-monitoring**: Add basic monitoring for API endpoints and error tracking

---

## 🚀 Getting Started

### Step 1: Build System Setup
```bash
# Create Vite config for extension
touch vite.extension.config.js
```

```javascript
// vite.extension.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: './src/extension/index.tsx',
      fileName: 'ai-generator',
      formats: ['iife'] // IIFE for maximum browser compatibility
    },
    outDir: 'extensions/theme-extension/assets',
    rollupOptions: {
      external: [], // Bundle everything for theme compatibility
      output: {
        globals: {},
        entryFileNames: 'ai-generator.js', // Ensure .js extension for browser compatibility
        extend: true // Allow global variable to be reassigned
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src')
    }
  }
});
```

### Step 2: Package.json Scripts
```json
{
  "scripts": {
    "build:extension": "vite build --config vite.extension.config.js",
    "dev:extension": "vite build --watch --config vite.extension.config.js",
    "dev": "concurrently \"npm run dev:extension\" \"shopify app dev\""
  }
}
```

### Step 3: Project Structure
```
src/
  extension/
    index.tsx              # Main SDK entry point
    api/
      client.ts           # Simple App Proxy API client
    components/
      ProductGenerator.tsx # Main product page component
      StyleSelector.tsx   # AI style selection
      ImageUpload.tsx     # Image upload component
      ProgressIndicator.tsx # Generation progress
    utils/
      pageDetection.ts    # Page type detection logic
      formIntegration.ts  # Cart form integration
  shared/
    types/
      api.ts              # Shared API types
    constants.ts          # Shared constants
```

### Step 4: Backend Routes
```bash
# Create backend route structure
mkdir -p app/routes/tools/ai-studio/api
```

Create these route files:
- `app/routes/tools/ai-studio/api/hello.tsx` (test endpoint)
- `app/routes/tools/ai-studio/api/products.$id.styles.tsx`
- `app/routes/tools/ai-studio/api/generations.tsx`
- `app/routes/tools/ai-studio/api/generations.$id.status.tsx`

---

## 🎯 Success Criteria

**Week 1 Complete**: 
- ✅ App Proxy configured and working
- ✅ Basic SDK loads on product pages
- ✅ Backend routes responding correctly

**Week 2 Complete**: 
- ✅ Full generation workflow functional end-to-end
- ✅ React UI components rendering
- ✅ Cart integration working

**Week 3 Complete**: 
- ✅ Cart page shows AI generations
- ✅ Error handling comprehensive
- ✅ Performance optimized

**Week 4 Complete**: 
- ✅ Production-ready deployment
- ✅ Cross-theme compatibility
- ✅ Documentation complete

---

## 🔄 When To Consider Advanced Options

You might need the complex architectures later if:

- **Generation times exceed 60+ seconds consistently**
- **Need true real-time collaboration features**
- **App Proxy latency becomes measurable user issue**
- **Require features Shopify infrastructure doesn't support**

## 📋 Task Status Legend
- [ ] Pending
- [🔄] In Progress  
- [✅] Completed
- [❌] Cancelled/Blocked

**Update this checklist as you progress through the implementation!**

---

**Bottom Line**: Start simple, ship fast, get user feedback. You can always add complexity later when you have real data showing it's needed. 