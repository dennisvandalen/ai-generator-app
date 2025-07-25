import type {LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import {Outlet} from "@remix-run/react";
import {authenticate} from "~/shopify.server";

export const loader = async ({request}: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function ProductbaseLayout() {
  return <Outlet />;
}