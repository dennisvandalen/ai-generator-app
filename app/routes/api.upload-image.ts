import { json, type ActionFunctionArgs } from "@remix-run/node";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { authenticate } from "../shopify.server";

// POST /api/upload-image
export const action = async ({ request }: ActionFunctionArgs) => {
  let shop: string;
  // Shopify App Proxy authentication
  try {
    const { session, liquid } = await authenticate.public.appProxy(request);
    if (!session) {
      return json({
        success: false,
        error: "Unauthorized - Shopify authentication failed",
        message: "No session returned from authentication"
      }, { status: 401 });
    }
    shop = session.shop;
  } catch (error) {
    return json({
      success: false,
      error: "Unauthorized - Shopify authentication failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 401 });
  }

  try {
    const { image, filename } = await request.json();
    if (!image || !filename) {
      return json({ error: "Missing image or filename" }, { status: 400 });
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const buffer = Buffer.from(image, "base64");

    // Detect MIME type
    let contentType = "image/png";
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      if (fileType && fileType.mime) {
        contentType = fileType.mime;
      }
    } catch (e) {
      // fallback to default
    }

    // Verify it's an image
    if (!contentType.startsWith("image/")) {
      return json({ error: "Uploaded file is not a valid image." }, { status: 400 });
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: `${shop}/uploads/${filename}`,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${shop}/uploads/${filename}`;
    return json({ url: publicUrl });
  } catch (error: any) {
    console.error("R2 upload error:", error);
    return json({ error: "Failed to upload image" }, { status: 500 });
  }
}; 