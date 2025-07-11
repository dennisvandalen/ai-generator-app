import { eq } from 'drizzle-orm';
import drizzleDb from '../db.server';
import { shopsTable, quotasTable, type NewShop, type NewQuota } from '../db/schema';

/**
 * Ensures a shop exists in the database, creating it only if needed
 * Returns the shop record
 */
export async function ensureShopExists(
  shopDomain: string,
  accessToken: string,
  scope: string | null,
  admin: any
) {
  try {
    // First check if shop already exists
    const existingShop = await drizzleDb
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.id, shopDomain))
      .limit(1);

    if (existingShop.length > 0) {
      // Shop exists, just update the access token and return
      const now = new Date().toISOString();
      await drizzleDb
        .update(shopsTable)
        .set({
          accessToken,
          scope: scope || '',
          updatedAt: now,
          isActive: true,
        })
        .where(eq(shopsTable.id, shopDomain));
      
      return existingShop[0];
    }

    // Shop doesn't exist, create it with full data
    console.log(`[SHOP_CREATION] Creating new shop record: ${shopDomain}`);
    
    // Fetch shop information from Shopify API
    const response = await admin.graphql(`
      query getShop {
        shop {
          name
          email
          plan {
            displayName
          }
        }
      }
    `);

    const responseJson = await response.json();
    const shopData = responseJson.data?.shop;

    const now = new Date().toISOString();

    const shopRecord: NewShop = {
      id: shopDomain,
      accessToken,
      scope: scope || '',
      shopName: shopData?.name || shopDomain,
      email: shopData?.email || null,
      planName: shopData?.plan?.displayName?.toLowerCase() || 'basic',
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    // Insert new shop
    await drizzleDb.insert(shopsTable).values(shopRecord);
    
    // Create default quota record for new shops
    const quotaRecord: NewQuota = {
      shopId: shopDomain,
      monthlyGenerationLimit: 500,
      storageQuotaMb: 1000,
      maxConcurrentGenerations: 3,
      currentGenerations: 0,
      currentStorageMb: 0,
      lastResetDate: now,
      totalGenerations: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    await drizzleDb.insert(quotasTable).values(quotaRecord);

    console.log(`[SHOP_CREATION] Successfully created shop: ${shopDomain}`);
    return shopRecord;
  } catch (error) {
    console.error(`[SHOP_CREATION] Error ensuring shop exists ${shopDomain}:`, error);
    throw error; // Re-throw since this indicates a serious issue
  }
}

/**
 * Gets shop data from database, returns null if not found
 */
export async function getShop(shopDomain: string) {
  try {
    const shops = await drizzleDb
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.id, shopDomain))
      .limit(1);
    
    return shops.length > 0 ? shops[0] : null;
  } catch (error) {
    console.error(`[SHOP_FETCH] Error fetching shop ${shopDomain}:`, error);
    return null;
  }
} 