import { Session } from "@shopify/shopify-app-remix/server";

/**
 * Extracts the shop ID from the session's shop domain.
 * @param shopDomain - The shop domain from the Shopify session (e.g., 'mystore.myshopify.com').
 * @returns The shop domain, which is used as the unique ID.
 */
export function getShopId(shopDomain: string): string {
  if (!shopDomain) {
    throw new Error("Shop domain is required to extract a shop ID.");
  }
  return shopDomain;
} 