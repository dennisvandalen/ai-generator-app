import { sqliteTable, text, integer, blob, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ===== EXISTING TABLES (OAuth & Session Management) =====

export const sessionTable = sqliteTable('session', {
  id: text('id').primaryKey(),
  shop: text('shop').notNull(),
  state: text('state').notNull(),
  isOnline: integer('isOnline', { mode: 'boolean' }).notNull().default(false),
  scope: text('scope'),
  expires: text('expires'),
  accessToken: text('accessToken'),
  userId: blob('userId', { mode: 'bigint' }),
});

// ===== CORE BUSINESS TABLES =====

export const shopsTable = sqliteTable('shops', {
  id: text('id').primaryKey(), // Shopify shop domain (e.g., 'mystore.myshopify.com')
  accessToken: text('accessToken').notNull(), // Current Shopify OAuth access token
  scope: text('scope'), // Granted OAuth scopes
  shopName: text('shopName'), // Display name of the shop
  email: text('email'), // Shop owner email
  planName: text('planName').default('basic'), // Subscription plan
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
  isActive: integer('isActive', { mode: 'boolean' }).default(true), // 0 = inactive, 1 = active
});

export const productsTable = sqliteTable('products', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull(), // UUID for routing (user-facing ID)
  shopId: text('shopId').notNull().references(() => shopsTable.id, { onDelete: 'cascade' }),
  shopifyProductId: integer('shopifyProductId', { mode: 'number' }).notNull(), // Shopify product ID (numeric only)
  title: text('title').notNull(), // Product title
  isEnabled: integer('isEnabled', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = enabled for AI
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('products_shop_shopify_product_unique').on(table.shopId, table.shopifyProductId),
  uniqueIndex('products_uuid_unique').on(table.uuid),
  index('products_shop_id_idx').on(table.shopId),
]);

export const sizesTable = sqliteTable('sizes', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull(), // UUID for routing (user-facing ID)
  productId: integer('productId').notNull().references(() => productsTable.id, { onDelete: 'cascade' }),
  shopifyVariantId: text('shopifyVariantId'), // Shopify variant GID (optional - sizes might not map 1:1 to variants)
  name: text('name').notNull(), // Display name (e.g., "A4", "Poster")
  widthPx: integer('widthPx').notNull(), // Width in pixels
  heightPx: integer('heightPx').notNull(), // Height in pixels
  isActive: integer('isActive', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = active
  sortOrder: integer('sortOrder').default(0), // Display order
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('sizes_uuid_unique').on(table.uuid),
  index('sizes_product_id_idx').on(table.productId),
  index('sizes_shopify_variant_id_idx').on(table.shopifyVariantId),
]);

export const aiStylesTable = sqliteTable('aiStyles', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull(), // UUID for routing (user-facing ID)
  shopId: text('shopId').notNull().references(() => shopsTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Style name (e.g., "Vintage Portrait")
  promptTemplate: text('promptTemplate').notNull(), // AI prompt with placeholders
  exampleImageUrl: text('exampleImageUrl'), // Preview example image URL
  isActive: integer('isActive', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = active
  sortOrder: integer('sortOrder').default(0), // Display order
  usageCount: integer('usageCount').default(0), // Track popularity
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  index('ai_styles_shop_id_idx').on(table.shopId),
  uniqueIndex('ai_styles_uuid_unique').on(table.uuid),
]);

export const generationsTable = sqliteTable('generations', {
  id: text('id').primaryKey(), // UUID
  shopId: text('shopId').notNull().references(() => shopsTable.id, { onDelete: 'cascade' }),
  productId: integer('productId').notNull().references(() => productsTable.id, { onDelete: 'cascade' }),
  sizeId: integer('sizeId').notNull().references(() => sizesTable.id, { onDelete: 'cascade' }),
  aiStyleId: integer('aiStyleId').notNull().references(() => aiStylesTable.id, { onDelete: 'cascade' }),
  orderId: text('orderId'), // Shopify order GID (null for previews)
  customerId: text('customerId'), // Shopify customer GID
  
  // Image data
  inputImageUrl: text('inputImageUrl').notNull(), // Original uploaded image URL
  previewImageUrl: text('previewImageUrl'), // Low-res preview URL (with watermark)
  finalImageUrl: text('finalImageUrl'), // High-res final URL (post-order)
  
  // Generation metadata
  generationType: text('generationType').notNull(), // 'preview' | 'final'
  status: text('status').default('pending'), // 'pending' | 'processing' | 'completed' | 'failed'
  aiPromptUsed: text('aiPromptUsed').notNull(), // Final prompt sent to AI
  errorMessage: text('errorMessage'), // Error details if failed
  
  // Processing info
  processingTimeMs: integer('processingTimeMs'), // Time taken to generate
  aiModelUsed: text('aiModelUsed'), // AI model identifier
  generationParams: text('generationParams'), // JSON of generation parameters
  
  // Upscaling info (for final images)
  upscaleStatus: text('upscaleStatus').default('not_needed'), // 'not_needed' | 'pending' | 'processing' | 'completed' | 'failed'
  upscaleFactor: real('upscaleFactor'), // Upscale multiplier (e.g., 2.0, 4.0)
  originalWidth: integer('originalWidth'), // Original image width before upscaling
  originalHeight: integer('originalHeight'), // Original image height before upscaling
  finalWidth: integer('finalWidth'), // Final image width after upscaling
  finalHeight: integer('finalHeight'), // Final image height after upscaling
  upscaleStartedAt: text('upscaleStartedAt'), // When upscaling began (ISO timestamp)
  upscaleCompletedAt: text('upscaleCompletedAt'), // When upscaling finished (ISO timestamp)
  
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  index('generations_shop_id_idx').on(table.shopId),
  index('generations_status_idx').on(table.status),
  index('generations_type_idx').on(table.generationType),
  index('generations_upscale_status_idx').on(table.upscaleStatus),
  index('generations_created_at_idx').on(table.createdAt),
]);

export const ordersTable = sqliteTable('orders', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  shopId: text('shopId').notNull().references(() => shopsTable.id, { onDelete: 'cascade' }),
  shopifyOrderId: text('shopifyOrderId').notNull(), // Shopify order GID
  customerId: text('customerId'), // Shopify customer GID
  orderNumber: text('orderNumber'), // Human-readable order number
  totalPrice: real('totalPrice'), // Order total
  status: text('status'), // Order status
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('orders_shop_shopify_order_unique').on(table.shopId, table.shopifyOrderId),
]);

export const watermarksTable = sqliteTable('watermarks', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  shopId: text('shopId').notNull().references(() => shopsTable.id, { onDelete: 'cascade' }),
  imageUrl: text('imageUrl').notNull(), // Watermark image URL in R2
  opacity: real('opacity').default(0.3), // Opacity (0.0 - 1.0)
  position: text('position').default('bottom-right'), // 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
  sizePercentage: real('sizePercentage').default(10), // Size as percentage of image
  isActive: integer('isActive', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = active
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
});

export const quotasTable = sqliteTable('quotas', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  shopId: text('shopId').notNull().references(() => shopsTable.id, { onDelete: 'cascade' }),
  
  // Limits
  monthlyGenerationLimit: integer('monthlyGenerationLimit').default(500), // Max generations per month
  storageQuotaMb: integer('storageQuotaMb').default(1000), // Storage limit in MB
  maxConcurrentGenerations: integer('maxConcurrentGenerations').default(3), // Concurrent generation limit
  
  // Current usage (reset monthly)
  currentGenerations: integer('currentGenerations').default(0), // This month's generations
  currentStorageMb: real('currentStorageMb').default(0), // Current storage usage
  
  // Tracking
  lastResetDate: text('lastResetDate').notNull(), // Last quota reset (ISO timestamp)
  totalGenerations: integer('totalGenerations').default(0), // All-time generations
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('quotas_shop_unique').on(table.shopId),
]);

// ===== RELATIONS =====

export const shopsRelations = relations(shopsTable, ({ many, one }) => ({
  products: many(productsTable),
  generations: many(generationsTable),
  orders: many(ordersTable),
  watermark: one(watermarksTable),
  quota: one(quotasTable),
}));

export const productsRelations = relations(productsTable, ({ one, many }) => ({
  shop: one(shopsTable, {
    fields: [productsTable.shopId],
    references: [shopsTable.id],
  }),
  sizes: many(sizesTable),
  aiStyles: many(aiStylesTable),
  generations: many(generationsTable),
}));

export const sizesRelations = relations(sizesTable, ({ one, many }) => ({
  product: one(productsTable, {
    fields: [sizesTable.productId],
    references: [productsTable.id],
  }),
  generations: many(generationsTable),
}));

export const aiStylesRelations = relations(aiStylesTable, ({ one, many }) => ({
  shop: one(shopsTable, {
    fields: [aiStylesTable.shopId],
    references: [shopsTable.id],
  }),
  generations: many(generationsTable),
}));

export const generationsRelations = relations(generationsTable, ({ one }) => ({
  shop: one(shopsTable, {
    fields: [generationsTable.shopId],
    references: [shopsTable.id],
  }),
  product: one(productsTable, {
    fields: [generationsTable.productId],
    references: [productsTable.id],
  }),
  size: one(sizesTable, {
    fields: [generationsTable.sizeId],
    references: [sizesTable.id],
  }),
  aiStyle: one(aiStylesTable, {
    fields: [generationsTable.aiStyleId],
    references: [aiStylesTable.id],
  }),
}));

export const ordersRelations = relations(ordersTable, ({ one }) => ({
  shop: one(shopsTable, {
    fields: [ordersTable.shopId],
    references: [shopsTable.id],
  }),
}));

// ===== TYPES =====

export type Session = typeof sessionTable.$inferSelect;
export type NewSession = typeof sessionTable.$inferInsert;

export type Shop = typeof shopsTable.$inferSelect;
export type NewShop = typeof shopsTable.$inferInsert;

export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;

export type Size = typeof sizesTable.$inferSelect;
export type NewSize = typeof sizesTable.$inferInsert;

export type AiStyle = typeof aiStylesTable.$inferSelect;
export type NewAiStyle = typeof aiStylesTable.$inferInsert;

export type Generation = typeof generationsTable.$inferSelect;
export type NewGeneration = typeof generationsTable.$inferInsert;

export type Order = typeof ordersTable.$inferSelect;
export type NewOrder = typeof ordersTable.$inferInsert;

export type Watermark = typeof watermarksTable.$inferSelect;
export type NewWatermark = typeof watermarksTable.$inferInsert;

export type Quota = typeof quotasTable.$inferSelect;
export type NewQuota = typeof quotasTable.$inferInsert;
