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

// ===== PRODUCT BASE SYSTEM =====

// Product Bases: Foundational templates (e.g., "Ceramic Mug", "Classic T-Shirt", "Canvas Print")
export const productBasesTable = sqliteTable('productBases', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull(), // UUID for routing (user-facing ID)
  shopId: text('shopId').notNull().references(() => shopsTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Display name (e.g., "Ceramic Mug", "Classic T-Shirt")
  description: text('description'), // Optional description
  isActive: integer('isActive', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = active
  sortOrder: integer('sortOrder').default(0), // Display order
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('product_bases_uuid_unique').on(table.uuid),
  index('product_bases_shop_id_idx').on(table.shopId),
]);

// Product Base Options: Options for product bases (e.g., "Size", "Color", "Material")
export const productBaseOptionsTable = sqliteTable('productBaseOptions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  productBaseId: integer('productBaseId').notNull().references(() => productBasesTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Option name (e.g., "Size", "Color", "Material")
  sortOrder: integer('sortOrder').default(0), // Display order
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  index('product_base_options_product_base_id_idx').on(table.productBaseId),
  uniqueIndex('product_base_options_product_base_id_name_unique').on(table.productBaseId, table.name),
]);

// Product Base Variants: Specific configurations (e.g., "White Mug", "S T-Shirt", "A4 Poster")
export const productBaseVariantsTable = sqliteTable('productBaseVariants', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull(), // UUID for routing (user-facing ID)
  productBaseId: integer('productBaseId').notNull().references(() => productBasesTable.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Variant name (e.g., "White", "S", "12x16")
  widthPx: integer('widthPx').notNull(), // Width in pixels for AI generation
  heightPx: integer('heightPx').notNull(), // Height in pixels for AI generation
  price: real('price').default(0), // Price adjustment (+/- from base price)
  compareAtPrice: real('compareAtPrice').default(0), // Price adjustment (+/- from base price)
  isActive: integer('isActive', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = active
  sortOrder: integer('sortOrder').default(0), // Display order within product base
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('product_base_variants_uuid_unique').on(table.uuid),
  index('product_base_variants_product_base_id_idx').on(table.productBaseId),
]);

// Product Base Variant Option Values: Values for product base variant options (e.g., "A4", "White")
export const productBaseVariantOptionValuesTable = sqliteTable('productBaseVariantOptionValues', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  productBaseVariantId: integer('productBaseVariantId').notNull().references(() => productBaseVariantsTable.id, { onDelete: 'cascade' }),
  productBaseOptionId: integer('productBaseOptionId').notNull().references(() => productBaseOptionsTable.id, { onDelete: 'cascade' }),
  value: text('value').notNull(), // Option value (e.g., "A4", "White")
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  index('product_base_variant_option_values_variant_id_idx').on(table.productBaseVariantId),
  index('product_base_variant_option_values_option_id_idx').on(table.productBaseOptionId),
  uniqueIndex('product_base_variant_option_values_variant_option_unique').on(table.productBaseVariantId, table.productBaseOptionId),
]);

// Junction table: Products can link to multiple Product Bases (many-to-many)
export const productProductBasesTable = sqliteTable('productProductBases', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  productId: integer('productId').notNull().references(() => productsTable.id, { onDelete: 'cascade' }),
  productBaseId: integer('productBaseId').notNull().references(() => productBasesTable.id, { onDelete: 'cascade' }),
  isEnabled: integer('isEnabled', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = enabled
  sortOrder: integer('sortOrder').default(0), // Display order
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('product_product_bases_unique').on(table.productId, table.productBaseId),
  index('product_product_bases_product_id_idx').on(table.productId),
  index('product_product_bases_product_base_id_idx').on(table.productBaseId),
]);

// Junction table for product-style relationships with ordering
export const productStylesTable = sqliteTable('productStyles', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  productId: integer('productId').notNull().references(() => productsTable.id, { onDelete: 'cascade' }),
  aiStyleId: integer('aiStyleId').notNull().references(() => aiStylesTable.id, { onDelete: 'cascade' }),
  sortOrder: integer('sortOrder').default(0), // For reordering styles
  isEnabled: integer('isEnabled', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = enabled
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('product_styles_product_style_unique').on(table.productId, table.aiStyleId),
  index('product_styles_product_id_idx').on(table.productId),
  index('product_styles_ai_style_id_idx').on(table.aiStyleId),
]);

// Junction table: Maps Product Base Variants to Shopify Product Variants
export const productBaseVariantMappingsTable = sqliteTable('productBaseVariantMappings', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  productId: integer('productId').notNull().references(() => productsTable.id, { onDelete: 'cascade' }),
  productBaseVariantId: integer('productBaseVariantId').notNull().references(() => productBaseVariantsTable.id, { onDelete: 'cascade' }),
  shopifyVariantId: integer('shopifyVariantId').notNull(), // Shopify variant ID
  isActive: integer('isActive', { mode: 'boolean' }).default(true), // 0 = disabled, 1 = active
  createdAt: text('createdAt').notNull(), // ISO timestamp
  updatedAt: text('updatedAt').notNull(), // ISO timestamp
}, (table) => [
  uniqueIndex('product_base_variant_mappings_unique').on(table.productId, table.productBaseVariantId, table.shopifyVariantId),
  index('product_base_variant_mappings_product_id_idx').on(table.productId),
  index('product_base_variant_mappings_product_base_variant_id_idx').on(table.productBaseVariantId),
  index('product_base_variant_mappings_shopify_variant_id_idx').on(table.shopifyVariantId),
]);

// ===== RELATIONS =====

export const shopsRelations = relations(shopsTable, ({ many, one }) => ({
  products: many(productsTable),
  generations: many(generationsTable),
  orders: many(ordersTable),
  watermark: one(watermarksTable),
  quota: one(quotasTable),
  productBases: many(productBasesTable),
}));

export const productsRelations = relations(productsTable, ({ one, many }) => ({
  shop: one(shopsTable, {
    fields: [productsTable.shopId],
    references: [shopsTable.id],
  }),
  productStyles: many(productStylesTable),
  generations: many(generationsTable),
  productProductBases: many(productProductBasesTable),
}));

export const aiStylesRelations = relations(aiStylesTable, ({ one, many }) => ({
  shop: one(shopsTable, {
    fields: [aiStylesTable.shopId],
    references: [shopsTable.id],
  }),
  productStyles: many(productStylesTable),
  generations: many(generationsTable),
}));

export const productStylesRelations = relations(productStylesTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [productStylesTable.productId],
    references: [productsTable.id],
  }),
  aiStyle: one(aiStylesTable, {
    fields: [productStylesTable.aiStyleId],
    references: [aiStylesTable.id],
  }),
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

// Product Base relations
export const productBasesRelations = relations(productBasesTable, ({ one, many }) => ({
  shop: one(shopsTable, {
    fields: [productBasesTable.shopId],
    references: [shopsTable.id],
  }),
  variants: many(productBaseVariantsTable),
  options: many(productBaseOptionsTable),
  productProductBases: many(productProductBasesTable),
}));

export const productBaseOptionsRelations = relations(productBaseOptionsTable, ({ one, many }) => ({
  productBase: one(productBasesTable, {
    fields: [productBaseOptionsTable.productBaseId],
    references: [productBasesTable.id],
  }),
  optionValues: many(productBaseVariantOptionValuesTable),
}));

export const productBaseVariantsRelations = relations(productBaseVariantsTable, ({ one, many }) => ({
  productBase: one(productBasesTable, {
    fields: [productBaseVariantsTable.productBaseId],
    references: [productBasesTable.id],
  }),
  optionValues: many(productBaseVariantOptionValuesTable),
  mappings: many(productBaseVariantMappingsTable),
}));

export const productBaseVariantOptionValuesRelations = relations(productBaseVariantOptionValuesTable, ({ one }) => ({
  variant: one(productBaseVariantsTable, {
    fields: [productBaseVariantOptionValuesTable.productBaseVariantId],
    references: [productBaseVariantsTable.id],
  }),
  option: one(productBaseOptionsTable, {
    fields: [productBaseVariantOptionValuesTable.productBaseOptionId],
    references: [productBaseOptionsTable.id],
  }),
}));

export const productProductBasesRelations = relations(productProductBasesTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [productProductBasesTable.productId],
    references: [productsTable.id],
  }),
  productBase: one(productBasesTable, {
    fields: [productProductBasesTable.productBaseId],
    references: [productBasesTable.id],
  }),
}));

export const productBaseVariantMappingsRelations = relations(productBaseVariantMappingsTable, ({ one }) => ({
  product: one(productsTable, {
    fields: [productBaseVariantMappingsTable.productId],
    references: [productsTable.id],
  }),
  productBaseVariant: one(productBaseVariantsTable, {
    fields: [productBaseVariantMappingsTable.productBaseVariantId],
    references: [productBaseVariantsTable.id],
  }),
}));

// ===== TYPES =====

export type Session = typeof sessionTable.$inferSelect;
export type NewSession = typeof sessionTable.$inferInsert;

export type Shop = typeof shopsTable.$inferSelect;
export type NewShop = typeof shopsTable.$inferInsert;

export type Product = typeof productsTable.$inferSelect;
export type NewProduct = typeof productsTable.$inferInsert;

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

export type ProductStyle = typeof productStylesTable.$inferSelect;
export type NewProductStyle = typeof productStylesTable.$inferInsert;

export type ProductBase = typeof productBasesTable.$inferSelect;
export type NewProductBase = typeof productBasesTable.$inferInsert;

export type ProductBaseVariant = typeof productBaseVariantsTable.$inferSelect;
export type NewProductBaseVariant = typeof productBaseVariantsTable.$inferInsert;

export type ProductProductBase = typeof productProductBasesTable.$inferSelect;
export type NewProductProductBase = typeof productProductBasesTable.$inferInsert;

export type ProductBaseOption = typeof productBaseOptionsTable.$inferSelect;
export type NewProductBaseOption = typeof productBaseOptionsTable.$inferInsert;

export type ProductBaseVariantOptionValue = typeof productBaseVariantOptionValuesTable.$inferSelect;
export type NewProductBaseVariantOptionValue = typeof productBaseVariantOptionValuesTable.$inferInsert;

export type ProductBaseVariantMapping = typeof productBaseVariantMappingsTable.$inferSelect;
export type NewProductBaseVariantMapping = typeof productBaseVariantMappingsTable.$inferInsert;
