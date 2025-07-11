import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
     try {
     // Use Shopify's built-in app proxy authentication (simpler approach)
     const { session } = await authenticate.public.appProxy(request);
     
     if (!session) {
       throw new Error("No session returned from authentication");
     }
     
     // If we get here, the request is authenticated!
     return json({
       success: true,
       message: "🔒 This is a secure, authenticated route!",
       shopifyContext: {
         shop: session.shop,
         isOnline: session.isOnline,
         sessionId: session.id
       },
       serverTimestamp: new Date().toISOString()
     });
  } catch (error) {
    return json({
      success: false,
      error: "Unauthorized - Shopify authentication failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 401 });
  }
} 