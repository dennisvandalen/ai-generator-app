import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";

import { Outlet } from "@remix-run/react";
import { BlockStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-remix/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return Response.json({});
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function ProductsLayout() {
  return (
    <BlockStack gap="500">
      <Outlet />
    </BlockStack>
  );
} 