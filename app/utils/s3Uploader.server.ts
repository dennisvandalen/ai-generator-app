import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";

interface UploadOptions {
  shop: string;
  filename: string;
  base64Image: string;
  pathPrefix?: string;
}

export async function uploadImageFromBase64({
  shop,
  filename,
  base64Image,
  pathPrefix = "uploads",
}: UploadOptions): Promise<{ url: string }> {
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const buffer = Buffer.from(base64Image, "base64");

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
    throw new Error("Uploaded file is not a valid image.");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const currentDate = `${year}${month}${day}`;

  const key = `${shop}/${pathPrefix}/${currentDate}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { url: publicUrl };
}