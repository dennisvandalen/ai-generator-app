import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

const DEBUG_REQUESTS = process.env.DEBUG_REQUESTS === 'true' || process.env.NODE_ENV === 'development';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  if (DEBUG_REQUESTS) {
    console.log(`[APP_LAYOUT] Loading app layout: ${url.pathname} | URL: ${request.url}`);
    
    // Log request details before authentication
    const shopParam = url.searchParams.get('shop');
    console.log(`[APP_LAYOUT] Shop from URL params: ${shopParam}`);
  }
  
  const { admin, session } = await authenticate.admin(request);
  
  if (DEBUG_REQUESTS) {
    // Log session details after authentication
    console.log(`[APP_LAYOUT] Session shop: ${session?.shop || 'null'}`);
  }

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app/productbase">
          Productbase
        </Link>
        <Link to="/app/products">
          Products
        </Link>
        <Link to="/app/styles">
          AI Styles
        </Link>
        <Link to="/app/generations">
          Generations
        </Link>
        <Link to="/app/orders">
          Orders
        </Link>
        <Link to="/app/analytics">
          Analytics
        </Link>
        <Link to="/app/downloads">
          Download Center
        </Link>
        <Link to="/app/settings">
          Settings
        </Link>
      </NavMenu>
      
      <div style={{paddingBottom: "100px"}}>
        <Outlet />
      </div>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
