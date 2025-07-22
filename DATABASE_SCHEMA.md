# Database Schema - Artify Product AI

## Overview
Database schema for the AI Image Generator Shopify App built on Cloudflare D1 (SQLite) using Drizzle ORM.

**Note**: This schema works alongside the existing `session` table for OAuth management. The `shops` table stores permanent shop configuration while `session` handles temporary OAuth state. All timestamps use ISO string format to match existing patterns.

## Core Tables

### shops
Stores Shopify shop information and OAuth tokens.

```sql
shops (
  id                TEXT PRIMARY KEY,           -- Shopify shop domain (e.g., 'mystore.myshopify.com')
  accessToken       TEXT NOT NULL,              -- Shopify OAuth access token
  scope             TEXT,                       -- Granted OAuth scopes
  shopName          TEXT,                       -- Display name of the shop
  email             TEXT,                       -- Shop owner email
  planName          TEXT DEFAULT 'basic',       -- Subscription plan
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  isActive          INTEGER DEFAULT 1           -- 0 = inactive, 1 = active
)
```

### products
Shopify products that are enabled for AI generation.

```sql
products (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,              -- UUID for routing (user-facing ID)
  shopId            TEXT NOT NULL,              -- Foreign key to shops.id
  shopifyProductId  INTEGER NOT NULL,           -- Shopify product ID (numeric only)
  title             TEXT NOT NULL,              -- Product title
  isEnabled         INTEGER DEFAULT 1,          -- 0 = disabled, 1 = enabled for AI
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shopId) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE(shopId, shopifyProductId),
  UNIQUE(uuid)
)
```

### sizes
Available size variants per product (A4, A3, Poster, etc.).

```sql
sizes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,              -- UUID for routing (user-facing ID)
  productId         INTEGER NOT NULL,           -- Foreign key to products.id
  shopifyVariantId  TEXT,                       -- Shopify variant GID (optional - sizes might not map 1:1 to variants)
  name              TEXT NOT NULL,              -- Display name (e.g., "A4", "Poster")
  widthPx           INTEGER NOT NULL,           -- Width in pixels
  heightPx          INTEGER NOT NULL,           -- Height in pixels
  isActive          INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  sortOrder         INTEGER DEFAULT 0,          -- Display order
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(uuid)
)
```

### aiStyles
Individual AI prompt variations with example previews.

```sql
aiStyles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,              -- UUID for routing (user-facing ID)
  shopId            TEXT NOT NULL,              -- Foreign key to shops.id
  name              TEXT NOT NULL,              -- Style name (e.g., "Vintage Portrait")
  promptTemplate    TEXT NOT NULL,              -- AI prompt with placeholders
  exampleImageUrl   TEXT,                       -- Preview example image URL
  isActive          INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  sortOrder         INTEGER DEFAULT 0,          -- Display order
  usageCount        INTEGER DEFAULT 0,          -- Track popularity
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shopId) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE(uuid)
)
```

### productStyles
Junction table for product-style relationships with ordering.

```sql
productStyles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  productId         INTEGER NOT NULL,           -- Foreign key to products.id
  aiStyleId         INTEGER NOT NULL,           -- Foreign key to aiStyles.id
  sortOrder         INTEGER DEFAULT 0,          -- For reordering styles
  isEnabled         INTEGER DEFAULT 1,          -- 0 = disabled, 1 = enabled
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (aiStyleId) REFERENCES aiStyles(id) ON DELETE CASCADE,
  UNIQUE(productId, aiStyleId)
)
```

### generations
Both preview and final high-resolution image generations.

```sql
generations (
  id                TEXT PRIMARY KEY,           -- UUID
  shopId            TEXT NOT NULL,              -- Foreign key to shops.id
  productId         INTEGER NOT NULL,           -- Foreign key to products.id
  aiStyleId         INTEGER NOT NULL,           -- Foreign key to aiStyles.id
  orderId           TEXT,                       -- Shopify order GID (null for previews)
  customerId        TEXT,                       -- Shopify customer GID
  
  -- Image data
  inputImageUrl     TEXT NOT NULL,              -- Original uploaded image URL
  previewImageUrl   TEXT,                       -- Low-res preview URL (with watermark)
  finalImageUrl     TEXT,                       -- High-res final URL (post-order)
  
  -- Generation metadata
  generationType    TEXT NOT NULL,              -- 'preview' | 'final'
  status            TEXT DEFAULT 'pending',     -- 'pending' | 'processing' | 'completed' | 'failed'
  aiPromptUsed      TEXT NOT NULL,              -- Final prompt sent to AI
  errorMessage      TEXT,                       -- Error details if failed
  
  -- Processing info
  processingTimeMs  INTEGER,                    -- Time taken to generate
  aiModelUsed       TEXT,                       -- AI model identifier
  generationParams  TEXT,                       -- JSON of generation parameters
  
  -- Upscaling info (for final images)
  upscaleStatus     TEXT DEFAULT 'not_needed',  -- 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed'
  upscaleFactor     REAL,                       -- Upscale multiplier (e.g., 2.0, 4.0)
  originalWidth     INTEGER,                    -- Original image width before upscaling
  originalHeight    INTEGER,                    -- Original image height before upscaling
  finalWidth        INTEGER,                    -- Final image width after upscaling
  finalHeight       INTEGER,                    -- Final image height after upscaling
  upscaleStartedAt  TEXT,                       -- When upscaling began (ISO timestamp)
  upscaleCompletedAt TEXT,                      -- When upscaling finished (ISO timestamp)
  
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shopId) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (aiStyleId) REFERENCES aiStyles(id) ON DELETE CASCADE
)
```

### orders
Track Shopify orders that contain AI-generated products.

```sql
orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  shopId            TEXT NOT NULL,              -- Foreign key to shops.id
  shopifyOrderId    TEXT NOT NULL,              -- Shopify order GID
  customerId        TEXT,                       -- Shopify customer GID
  orderNumber       TEXT,                       -- Human-readable order number
  totalPrice        REAL,                       -- Order total
  status            TEXT,                       -- Order status
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shopId) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE(shopId, shopifyOrderId)
)
```

### watermarks
Shop-specific watermark/logo settings.

```sql
watermarks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  shopId            TEXT NOT NULL,              -- Foreign key to shops.id
  imageUrl          TEXT NOT NULL,              -- Watermark image URL in R2
  opacity           REAL DEFAULT 0.3,           -- Opacity (0.0 - 1.0)
  position          TEXT DEFAULT 'bottom-right',-- 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
  sizePercentage    REAL DEFAULT 10,            -- Size as percentage of image
  isActive          INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shopId) REFERENCES shops(id) ON DELETE CASCADE
)
```

### quotas
Per-shop usage limits and tracking.

```sql
quotas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  shopId            TEXT NOT NULL,              -- Foreign key to shops.id
  
  -- Limits
  monthlyGenerationLimit INTEGER DEFAULT 500,   -- Max generations per month
  storageQuotaMb    INTEGER DEFAULT 1000,       -- Storage limit in MB
  maxConcurrentGenerations INTEGER DEFAULT 3,   -- Concurrent generation limit
  
  -- Current usage (reset monthly)
  currentGenerations INTEGER DEFAULT 0,         -- This month's generations
  currentStorageMb  REAL DEFAULT 0,             -- Current storage usage
  
  -- Tracking
  lastResetDate     TEXT NOT NULL,              -- Last quota reset (ISO timestamp)
  totalGenerations  INTEGER DEFAULT 0,          -- All-time generations
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shopId) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE(shopId)
)
```

## Product Base System

### productBases
Foundational templates (e.g., "Ceramic Mug", "Classic T-Shirt", "Canvas Print").

```sql
productBases (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,              -- UUID for routing (user-facing ID)
  shopId            TEXT NOT NULL,              -- Foreign key to shops.id
  name              TEXT NOT NULL,              -- Display name (e.g., "Ceramic Mug", "Classic T-Shirt")
  description       TEXT,                       -- Optional description
  optionNames       TEXT,                       -- JSON array of option names (e.g., ["Size", "Color", "Material"])
  basePrice         REAL,                       -- Optional base pricing
  isActive          INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  sortOrder         INTEGER DEFAULT 0,          -- Display order
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shopId) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE(uuid)
)
```

### productBaseVariants
Specific configurations (e.g., "White Mug", "S T-Shirt", "A4 Poster").

```sql
productBaseVariants (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL,              -- UUID for routing (user-facing ID)
  productBaseId     INTEGER NOT NULL,           -- Foreign key to productBases.id
  name              TEXT NOT NULL,              -- Variant name (e.g., "White", "S", "12x16")
  optionValues      TEXT,                       -- JSON object of option values (e.g., {"Size": "A4", "Color": "White"})
  widthPx           INTEGER NOT NULL,           -- Width in pixels for AI generation
  heightPx          INTEGER NOT NULL,           -- Height in pixels for AI generation
  priceModifier     REAL DEFAULT 0,             -- Price adjustment (+/- from base price)
  isActive          INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  sortOrder         INTEGER DEFAULT 0,          -- Display order within product base
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (productBaseId) REFERENCES productBases(id) ON DELETE CASCADE,
  UNIQUE(uuid)
)
```

### productProductBases
Junction table: Products can link to multiple Product Bases (many-to-many).

```sql
productProductBases (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  productId         INTEGER NOT NULL,           -- Foreign key to products.id
  productBaseId     INTEGER NOT NULL,           -- Foreign key to productBases.id
  isEnabled         INTEGER DEFAULT 1,          -- 0 = disabled, 1 = enabled
  sortOrder         INTEGER DEFAULT 0,          -- Display order
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (productBaseId) REFERENCES productBases(id) ON DELETE CASCADE,
  UNIQUE(productId, productBaseId)
)
```

### productBaseVariantMappings
Maps Product Base Variants to Shopify Product Variants.

```sql
productBaseVariantMappings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  productId         INTEGER NOT NULL,           -- Foreign key to products.id
  productBaseVariantId INTEGER NOT NULL,        -- Foreign key to productBaseVariants.id
  shopifyVariantId  TEXT NOT NULL,              -- Shopify variant GID
  isActive          INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  createdAt         TEXT NOT NULL,              -- ISO timestamp
  updatedAt         TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (productBaseVariantId) REFERENCES productBaseVariants(id) ON DELETE CASCADE,
  UNIQUE(productId, productBaseVariantId, shopifyVariantId)
)
```

## Indexes

### Performance Indexes
```sql
-- Shop lookups
CREATE INDEX idx_products_shop_id ON products(shopId);
CREATE INDEX idx_generations_shop_id ON generations(shopId);
CREATE INDEX idx_orders_shop_id ON orders(shopId);
CREATE INDEX idx_product_bases_shop_id_idx ON productBases(shopId);
CREATE INDEX idx_ai_styles_shop_id_idx ON aiStyles(shopId);

-- Product relationships
CREATE INDEX idx_sizes_product_id_idx ON sizes(productId);
CREATE INDEX idx_generations_product_id ON generations(productId);
CREATE INDEX idx_product_styles_product_id_idx ON productStyles(productId);
CREATE INDEX idx_product_product_bases_product_id_idx ON productProductBases(productId);
CREATE INDEX idx_product_base_variant_mappings_product_id_idx ON productBaseVariantMappings(productId);

-- Style relationships
CREATE INDEX idx_generations_ai_style_id ON generations(aiStyleId);
CREATE INDEX idx_product_styles_ai_style_id_idx ON productStyles(aiStyleId);

-- Product Base relationships
CREATE INDEX idx_product_base_variants_product_base_id_idx ON productBaseVariants(productBaseId);
CREATE INDEX idx_product_product_bases_product_base_id_idx ON productProductBases(productBaseId);
CREATE INDEX idx_product_base_variant_mappings_product_base_variant_id_idx ON productBaseVariantMappings(productBaseVariantId);
CREATE INDEX idx_product_base_variant_mappings_shopify_variant_id_idx ON productBaseVariantMappings(shopifyVariantId);

-- Generation status tracking
CREATE INDEX idx_generations_status_idx ON generations(status);
CREATE INDEX idx_generations_type_idx ON generations(generationType);
CREATE INDEX idx_generations_upscale_status_idx ON generations(upscaleStatus);

-- Time-based queries
CREATE INDEX idx_generations_created_at_idx ON generations(createdAt);

-- UUID lookups
CREATE INDEX idx_products_uuid_unique ON products(uuid);
CREATE INDEX idx_sizes_uuid_unique ON sizes(uuid);
CREATE INDEX idx_ai_styles_uuid_unique ON aiStyles(uuid);
CREATE INDEX idx_product_bases_uuid_unique ON productBases(uuid);
CREATE INDEX idx_product_base_variants_uuid_unique ON productBaseVariants(uuid);

-- Shopify ID lookups
CREATE INDEX idx_orders_shopify_order_unique ON orders(shopifyOrderId);
```

## Relationships Summary

1. **Shop → Products**: One-to-many (shop can have multiple AI-enabled products)
2. **Shop → AI Styles**: One-to-many (shop can have multiple AI styles)
3. **Shop → Product Bases**: One-to-many (shop can have multiple product bases)
4. **Product → Sizes**: One-to-many (product can have multiple size variants)
5. **Product ↔ AI Styles**: Many-to-many through productStyles junction table
6. **Product ↔ Product Bases**: Many-to-many through productProductBases junction table
7. **Product Base → Product Base Variants**: One-to-many (base can have multiple variants)
8. **Product + Product Base Variant → Shopify Variant**: Mapped through productBaseVariantMappings
9. **Generation**: References shop, product, and AI style
10. **Shop → Watermark**: One-to-one (shop has one watermark configuration)
11. **Shop → Quota**: One-to-one (shop has one quota configuration)

## Key Design Decisions

1. **Session vs Shop Separation**: The `shops` table stores permanent shop data while the existing `session` table handles OAuth flow. Shop records are created/updated from session data, providing stable references for business logic.

2. **UUIDs for Routing**: Using UUIDs for user-facing routes to avoid exposing internal IDs and to support better distribution.

3. **Product Base System**: A flexible system that allows defining product templates (bases) with variants that can be mapped to Shopify product variants, enabling consistent AI generation across similar products.

4. **Direct AI Style to Shop Relationship**: AI styles belong directly to shops rather than being organized in collections, allowing for more flexible style management.

5. **Junction Tables with Metadata**: Junction tables like productStyles and productProductBases include additional metadata like sort order and enabled status.

6. **Soft Deletes**: Using `isActive` flags instead of hard deletes to preserve generation history.

7. **Status Tracking**: Comprehensive status fields for async generation processing.

8. **Post-Purchase Upscaling**: Separate tracking for upscaling final images after order placement with detailed resolution and timing metadata.

9. **Usage Analytics**: Built-in counters for tracking usage patterns and popular styles.

10. **Shopify Integration**: Direct references to Shopify IDs and ISO timestamp format for seamless integration.

11. **File Storage**: URLs point to Cloudflare R2 storage, with metadata stored in D1.
