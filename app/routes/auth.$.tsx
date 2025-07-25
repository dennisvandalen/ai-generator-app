import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-remix/server";

const DEBUG_REQUESTS = process.env.DEBUG_REQUESTS === 'true' || process.env.NODE_ENV === 'development';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (DEBUG_REQUESTS) {
    const url = new URL(request.url);
    console.log(`[AUTH] Authentication request: ${url.pathname} | URL: ${request.url}`);
  }
  
  await authenticate.admin(request);

  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
