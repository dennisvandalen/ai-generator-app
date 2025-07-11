# Database Schema - Artify Product AI

## Overview
Database schema for the AI Image Generator Shopify App built on Cloudflare D1 (SQLite).

**Note**: This schema works alongside the existing `session` table for OAuth management. The `shops` table stores permanent shop configuration while `session` handles temporary OAuth state. All timestamps use ISO string format to match existing patterns.

## Core Tables

### shops
Stores Shopify shop information and OAuth tokens.

```sql
shops (
  id                TEXT PRIMARY KEY,           -- Shopify shop domain (e.g., 'mystore.myshopify.com')
  access_token      TEXT NOT NULL,              -- Shopify OAuth access token
  scope             TEXT,                       -- Granted OAuth scopes
  shop_name         TEXT,                       -- Display name of the shop
  email             TEXT,                       -- Shop owner email
  plan_name         TEXT DEFAULT 'basic',       -- Subscription plan
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  is_active         INTEGER DEFAULT 1           -- 0 = inactive, 1 = active
)
```

### products
Shopify products that are enabled for AI generation.

```sql
products (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id           TEXT NOT NULL,              -- Foreign key to shops.id
  shopify_product_id TEXT NOT NULL,             -- Shopify product GID (e.g., 'gid://shopify/Product/123')
  title             TEXT NOT NULL,              -- Product title
  handle            TEXT NOT NULL,              -- Product handle/slug
  is_enabled        INTEGER DEFAULT 1,          -- 0 = disabled, 1 = enabled for AI
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE(shop_id, shopify_product_id)
)
```

### sizes
Available size variants per product (A4, A3, Poster, etc.).

```sql
sizes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id        INTEGER NOT NULL,           -- Foreign key to products.id
  name              TEXT NOT NULL,              -- Display name (e.g., "A4", "Poster")
  width_px          INTEGER NOT NULL,           -- Width in pixels
  height_px         INTEGER NOT NULL,           -- Height in pixels
  is_active         INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  sort_order        INTEGER DEFAULT 0,          -- Display order
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
)
```

### style_collections
Groups of AI styles per product for organization.

```sql
style_collections (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id        INTEGER NOT NULL,           -- Foreign key to products.id
  name              TEXT NOT NULL,              -- Collection name (e.g., "Abstract", "Realistic")
  description       TEXT,                       -- Optional description
  is_active         INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  sort_order        INTEGER DEFAULT 0,          -- Display order
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
)
```

### ai_styles
Individual AI prompt variations with example previews.

```sql
ai_styles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  style_collection_id INTEGER NOT NULL,         -- Foreign key to style_collections.id
  name              TEXT NOT NULL,              -- Style name (e.g., "Vintage Portrait")
  prompt_template   TEXT NOT NULL,              -- AI prompt with placeholders
  negative_prompt   TEXT,                       -- Negative prompt for AI
  example_image_url TEXT,                       -- Preview example image URL
  is_active         INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  sort_order        INTEGER DEFAULT 0,          -- Display order
  usage_count       INTEGER DEFAULT 0,          -- Track popularity
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (style_collection_id) REFERENCES style_collections(id) ON DELETE CASCADE
)
```

### generations
Both preview and final high-resolution image generations.

```sql
generations (
  id                TEXT PRIMARY KEY,           -- UUID
  shop_id           TEXT NOT NULL,              -- Foreign key to shops.id
  product_id        INTEGER NOT NULL,           -- Foreign key to products.id
  size_id           INTEGER NOT NULL,           -- Foreign key to sizes.id
  ai_style_id       INTEGER NOT NULL,           -- Foreign key to ai_styles.id
  order_id          TEXT,                       -- Shopify order GID (null for previews)
  customer_id       TEXT,                       -- Shopify customer GID
  
  -- Image data
  input_image_url   TEXT NOT NULL,              -- Original uploaded image URL
  preview_image_url TEXT,                       -- Low-res preview URL (with watermark)
  final_image_url   TEXT,                       -- High-res final URL (post-order)
  
  -- Generation metadata
  generation_type   TEXT NOT NULL,              -- 'preview' | 'final'
  status            TEXT DEFAULT 'pending',     -- 'pending' | 'processing' | 'completed' | 'failed'
  ai_prompt_used    TEXT NOT NULL,              -- Final prompt sent to AI
  error_message     TEXT,                       -- Error details if failed
  
  -- Processing info
  processing_time_ms INTEGER,                   -- Time taken to generate
  ai_model_used     TEXT,                       -- AI model identifier
  generation_params TEXT,                       -- JSON of generation parameters
  
  -- Upscaling info (for final images)
  upscale_status    TEXT DEFAULT 'not_needed',  -- 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed'
  upscale_factor    REAL,                       -- Upscale multiplier (e.g., 2.0, 4.0)
  original_width    INTEGER,                    -- Original image width before upscaling
  original_height   INTEGER,                    -- Original image height before upscaling
  final_width       INTEGER,                    -- Final image width after upscaling
  final_height      INTEGER,                    -- Final image height after upscaling
  upscale_started_at TEXT,                      -- When upscaling began (ISO timestamp)
  upscale_completed_at TEXT,                    -- When upscaling finished (ISO timestamp)
  
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (size_id) REFERENCES sizes(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_style_id) REFERENCES ai_styles(id) ON DELETE CASCADE
)
```

### orders
Track Shopify orders that contain AI-generated products.

```sql
orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id           TEXT NOT NULL,              -- Foreign key to shops.id
  shopify_order_id  TEXT NOT NULL,              -- Shopify order GID
  customer_id       TEXT,                       -- Shopify customer GID
  order_number      TEXT,                       -- Human-readable order number
  total_price       REAL,                       -- Order total
  status            TEXT,                        -- Order status
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE(shop_id, shopify_order_id)
)
```

### watermarks
Shop-specific watermark/logo settings.

```sql
watermarks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id           TEXT NOT NULL,              -- Foreign key to shops.id
  image_url         TEXT NOT NULL,              -- Watermark image URL in R2
  opacity           REAL DEFAULT 0.3,           -- Opacity (0.0 - 1.0)
  position          TEXT DEFAULT 'bottom-right',-- 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
  size_percentage   REAL DEFAULT 10,            -- Size as percentage of image
  is_active         INTEGER DEFAULT 1,          -- 0 = disabled, 1 = active
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
)
```

### quotas
Per-shop usage limits and tracking.

```sql
quotas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id           TEXT NOT NULL,              -- Foreign key to shops.id
  
  -- Limits
  monthly_generation_limit INTEGER DEFAULT 500, -- Max generations per month
  storage_quota_mb  INTEGER DEFAULT 1000,       -- Storage limit in MB
  max_concurrent_generations INTEGER DEFAULT 3, -- Concurrent generation limit
  
  -- Current usage (reset monthly)
  current_generations INTEGER DEFAULT 0,        -- This month's generations
  current_storage_mb REAL DEFAULT 0,            -- Current storage usage
  
  -- Tracking
  last_reset_date   TEXT NOT NULL,              -- Last quota reset (ISO timestamp)
  total_generations INTEGER DEFAULT 0,          -- All-time generations
  created_at        TEXT NOT NULL,              -- ISO timestamp
  updated_at        TEXT NOT NULL,              -- ISO timestamp
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE(shop_id)
)
```

## Indexes

### Performance Indexes
```sql
-- Shop lookups
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_generations_shop_id ON generations(shop_id);
CREATE INDEX idx_orders_shop_id ON orders(shop_id);

-- Product relationships
CREATE INDEX idx_sizes_product_id ON sizes(product_id);
CREATE INDEX idx_style_collections_product_id ON style_collections(product_id);
CREATE INDEX idx_generations_product_id ON generations(product_id);

-- Style relationships
CREATE INDEX idx_ai_styles_collection_id ON ai_styles(style_collection_id);
CREATE INDEX idx_generations_ai_style_id ON generations(ai_style_id);

-- Generation status tracking
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_type ON generations(generation_type);
CREATE INDEX idx_generations_order_id ON generations(order_id);
CREATE INDEX idx_generations_upscale_status ON generations(upscale_status);

-- Time-based queries
CREATE INDEX idx_generations_created_at ON generations(created_at);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Shopify GID lookups
CREATE INDEX idx_products_shopify_id ON products(shopify_product_id);
CREATE INDEX idx_orders_shopify_id ON orders(shopify_order_id);
```

## Relationships Summary

1. **Shop → Products**: One-to-many (shop can have multiple AI-enabled products)
2. **Product → Sizes**: One-to-many (product can have multiple size variants)
3. **Product → Style Collections**: One-to-many (product can have multiple style groups)
4. **Style Collection → AI Styles**: One-to-many (collection contains multiple styles)
5. **Generation**: References shop, product, size, and AI style
6. **Shop → Watermark**: One-to-one (shop has one watermark configuration)
7. **Shop → Quota**: One-to-one (shop has one quota configuration)

## Key Design Decisions

1. **Session vs Shop Separation**: The `shops` table stores permanent shop data while the existing `session` table handles OAuth flow. Shop records are created/updated from session data, providing stable references for business logic.

2. **UUIDs for Generations**: Using TEXT PRIMARY KEY for generations to support UUIDs for better distribution and external API references.

3. **Soft Deletes**: Using `is_active` flags instead of hard deletes to preserve generation history.

4. **Status Tracking**: Comprehensive status fields for async generation processing.

5. **Post-Purchase Upscaling**: Separate tracking for upscaling final images after order placement with detailed resolution and timing metadata.

6. **Usage Analytics**: Built-in counters for tracking usage patterns and popular styles.

7. **Shopify Integration**: Direct references to Shopify GIDs (Global IDs) and ISO timestamp format for seamless integration.

8. **File Storage**: URLs point to Cloudflare R2 storage, with metadata stored in D1. 