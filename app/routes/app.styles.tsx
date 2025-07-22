import type {LoaderFunctionArgs} from "@remix-run/node";

import {Outlet} from "@remix-run/react";
import {authenticate} from "~/shopify.server";

export const loader = async ({request}: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return Response.json({});
};

export default function StylesLayout() {
  return (
    <Outlet/>
  );
}
