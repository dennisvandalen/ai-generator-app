import { DrizzleSessionStorageSQLite } from "@shopify/shopify-app-session-storage-drizzle";
import type { Session } from "@shopify/shopify-app-remix/server";
import { ensureShopExists } from "./shopHelpers.server";

/**
 * CustomSessionStorage extends the default Shopify session storage to ensure that
 * when a shop installs our app (creating a session), we also create a corresponding
 * shop record in our database.
 *
 * Why we need this:
 * 1. Data consistency - Ensures our database has records for all shops that have installed the app
 * 2. Initialization - Allows us to set up initial shop data and preferences when a shop first installs
 * 3. Reliability - Prevents scenarios where we have sessions but missing shop records, which could cause errors
 * 4. Synchronization - Keeps our database in sync with Shopify's session data
 *
 * This approach guarantees that any time a merchant installs our app, we'll have the necessary
 * shop data available for all app functionality that depends on shop information.
 */
export class CustomSessionStorage extends DrizzleSessionStorageSQLite {
  async storeSession(session: Session): Promise<boolean> {
    try {
      // First store the session using the parent implementation
      const result = await super.storeSession(session);

      // If session storage was successful and we have the required data, ensure shop exists
      if (result && session.shop && session.accessToken && !session.isOnline) {
        // Only create shop records for offline sessions (permanent app installation)
        // Online sessions are temporary user sessions
        console.log(`[SESSION_STORAGE] Creating shop record for offline session: ${session.shop}`);

        try {
          // We need to create a minimal admin context for the GraphQL query
          const adminContext = {
            graphql: async (query: string) => {
              const response = await fetch(`https://${session.shop}/admin/api/2025-01/graphql.json`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Shopify-Access-Token': session.accessToken!,
                },
                body: JSON.stringify({ query }),
              });
              return {
                json: () => response.json(),
              };
            },
          };

          await ensureShopExists(
            session.shop,
            session.accessToken,
            session.scope || null,
            adminContext
          );
        } catch (error) {
          console.error(`[SESSION_STORAGE] Failed to create shop record for ${session.shop}:`, error);
          // Don't fail session storage if shop creation fails
        }
      }

      return result;
    } catch (error) {
      console.error(`[SESSION_STORAGE] Error in custom session storage:`, error);
      // Fallback to parent implementation
      return super.storeSession(session);
    }
  }
}
