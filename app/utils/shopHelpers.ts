/**
 * Extracts the numeric ID from a Shopify GID
 * Example: "gid://shopify/ProductVariant/55355381809538" -> "55355381809538"
 */
export function extractShopifyId(gid: string | number): string {
  if (!gid) return '';

  // Convert to string if it's not already a string
  const gidStr = String(gid);

  // If it doesn't contain slashes, it's likely already an ID
  if (!gidStr.includes('/')) {
    return gidStr;
  }

  // Extract the ID part after the last slash
  const parts = gidStr.split('/');
  return parts[parts.length - 1];
}
