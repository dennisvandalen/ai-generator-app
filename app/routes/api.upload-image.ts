import { type ActionFunctionArgs, data } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { uploadImageFromBase64 } from "~/utils/s3Uploader.server";

// POST /api/upload-image
export const action = async ({ request }: ActionFunctionArgs) => {
  let shop: string;
  // Shopify App Proxy authentication
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session) {
      return data(
        {
          success: false,
          error: "Unauthorized - Shopify authentication failed",
          message: "No session returned from authentication",
        },
        { status: 401 },
      );
    }
    shop = session.shop;
  } catch (error) {
    return data(
      {
        success: false,
        error: "Unauthorized - Shopify authentication failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 401 },
    );
  }

  try {
    const { image, filename } = await request.json();
    if (!image || !filename) {
      return data({ error: "Missing image or filename" }, { status: 400 });
    }

    const { url } = await uploadImageFromBase64({
      shop,
      filename,
      base64Image: image,
    });

    return data({ url });
  } catch (error: any) {
    console.error("Image upload error:", error);
    return data({ error: error.message || "Failed to upload image" }, { status: 500 });
  }
};
