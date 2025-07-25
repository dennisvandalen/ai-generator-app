/**
 * Shared Constants for AI Generator App
 * Keep in sync with app/constants.ts and block.liquid
 */

// Metafield constants
export const AI_METAFIELD_NAMESPACE = '__aiConverterV1';

export const AI_METAFIELD_KEYS = {
  AI_ENABLED: 'ai_enabled',
  LAST_UPDATED: 'last_updated',
  ENABLE_FOR_ALL_PAGES: 'enable_for_all_pages',
  ENABLE_ON_CART: 'enable_on_cart',
  ENABLE_ON_COLLECTION: 'enable_on_collection',
} as const;

// App Proxy configuration
export const APP_PROXY_CONFIG = {
  PREFIX: 'tools',
  SUBPATH: 'autopictura',
  BASE_PATH: '/tools/autopictura/api',
} as const;

// Generation status values
export const GENERATION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Polling configuration
export const POLLING_CONFIG = {
  INTERVAL_MS: 3000, // 3 seconds
  MAX_ATTEMPTS: 60, // 3 minutes max
} as const;

// Page types
export const PAGE_TYPES = {
  PRODUCT: 'product',
  CART: 'cart',
  COLLECTION: 'collection',
  HOME: 'home',
  OTHER: 'other',
} as const;
