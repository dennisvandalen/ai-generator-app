import { type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("=== APP PROXY AUTHENTICATED ROUTE (Shopify Auth) ===");

     try {
     // Use Shopify's built-in app proxy authentication
     const { session, liquid } = await authenticate.public.appProxy(request);

     console.log("✅ Shopify authentication successful");
     console.log("Session:", session);
     console.log("Liquid context:", liquid);

     if (!session) {
       throw new Error("No session returned from authentication");
     }

     return Response.json({
       success: true,
       message: "✅ Authenticated with Shopify's built-in method!",
       authenticated: true,
       timestamp: new Date().toISOString(),
       shopifyContext: {
         shop: session.shop,
         isOnline: session.isOnline,
         liquidContext: liquid,
         sessionId: session.id
       }
     });
  } catch (error) {
    console.log("❌ Shopify authentication failed:", error);

    return Response.json({
      success: false,
      error: "Unauthorized - Shopify authentication failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 401 });
  }
}
