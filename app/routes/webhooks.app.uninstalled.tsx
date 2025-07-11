import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { eq } from 'drizzle-orm';
import drizzleDb from "../db.server";
import { sessionTable, shopsTable } from "../db/schema";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    // Delete all sessions for this shop
    await drizzleDb
      .delete(sessionTable)
      .where(eq(sessionTable.shop, shop));
    
    // Mark shop as inactive instead of deleting to preserve historical data
    await drizzleDb
      .update(shopsTable)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shopsTable.id, shop));
  }

  return new Response();
};
