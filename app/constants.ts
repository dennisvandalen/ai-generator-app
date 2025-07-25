export const APP_NAME = "Autopictura";

export const APP_CONFIG = {
  name: APP_NAME,
  description: "Create beautiful, custom posters of your pets using the power of AI",
  tagline: "Transform your pet photos into stunning wall art with AI",
} as const;

/**
 * Metafield constants for AI converter
 *
 * These constants are shared between:
 * - App (this file): Used in GraphQL mutations and queries
 * - Theme extension: Manually synced in extensions/theme-extension/blocks/block.liquid
 *
 * When updating these values, make sure to update both locations!
 */
export const METAFIELDS = {
  NAMESPACE: "__aiConverterV1",
  KEYS: {
    AI_ENABLED: "ai_enabled",
    LAST_UPDATED: "last_updated",
    // Shop-level configuration (for future use)
    ENABLE_FOR_ALL_PAGES: "enable_for_all_pages",
    ENABLE_ON_CART: "enable_on_cart",
    ENABLE_ON_COLLECTION: "enable_on_collection",
  }
} as const;

// Export individual constants for convenience
export const AI_METAFIELD_NAMESPACE = METAFIELDS.NAMESPACE;
export const AI_METAFIELD_KEYS = METAFIELDS.KEYS;
