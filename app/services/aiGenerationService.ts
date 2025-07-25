import { fal } from "@fal-ai/client";
import { BlendMode, Jimp } from 'jimp';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";

interface GenerateImageParams {
  prompt: string;
  imageUrl: string;
  numImages: number;
  styleImageUrl: string;
  bypassMock?: boolean;
}

interface GenerationResult {
  imageUrls: string[];
  processingTimeMs: number;
  // Add other relevant fields from FAL response if needed
}

export class AIGenerationService {
  private s3: S3Client;

  constructor() {
    fal.config({
      credentials: process.env.FAL_KEY,
    });
    this.s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async generateImage(params: GenerateImageParams): Promise<GenerationResult> {
    const { prompt, imageUrl, numImages, styleImageUrl, bypassMock } = params;
    const startTime = Date.now();

    if (process.env.MOCK_AI_GENERATION === 'true' && !bypassMock) {
      const mockImageUrls: string[] = [];

      for (let i = 0; i < numImages; i++) {
        try {
          const response = await fetch(imageUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const image = await Jimp.read(buffer);

          // add some random filters
          image.greyscale().contrast(1);

          // merge with the style image
          // Put style image in the bottom right corner of the image
          const styleImage = await Jimp.read(styleImageUrl);
          // resize style to 25% width and maintain aspect ratio
          const styleWidth = Math.floor(image.bitmap.width * 0.25);
          styleImage.resize({w: styleWidth});

          // put in the bottom right corner
          image.composite(styleImage, image.bitmap.width - styleWidth, image.bitmap.height - styleImage.bitmap.height, {
            mode: BlendMode.SRC_OVER, // Use SOURCE_OVER instead of OVERLAY to show original style image
            opacitySource: 1,
            opacityDest: 1,
          });

          const mime = (await fileTypeFromBuffer(buffer))?.mime || 'image/png';
          const newBuffer = await image.getBuffer('image/jpeg');

          const filename = `mock-ai-art-${Date.now()}-${i}.jpeg`;
          const key = `mocked-uploads/${filename}`;

          await this.s3.send(
            new PutObjectCommand({
              Bucket: process.env.R2_BUCKET!,
              Key: key,
              Body: newBuffer,
              ContentType: mime,
            })
          );
          mockImageUrls.push(`${process.env.R2_PUBLIC_URL}/${key}`);
        } catch (error) {
          console.error("Error processing or uploading mocked image:", error);
          // Fallback to original image URL if processing fails
          mockImageUrls.push(imageUrl);
        }
      }

      const processingTime = Date.now() - startTime;
      return {
        imageUrls: mockImageUrls,
        processingTimeMs: processingTime,
      };
    }

    // Use FAL AI FLUX Pro Kontext model for image transformation
    const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: {
        prompt: prompt,
        image_url: imageUrl,
        guidance_scale: 3.5,
        num_images: numImages,
        output_format: "png",
      }
    }) as any;

    const processingTime = Date.now() - startTime;

    let generatedImageUrls: string[] = [];
    if (result?.data?.images && Array.isArray(result.data.images) && result.data.images.length > 0) {
      generatedImageUrls = result.data.images.map((img: any) => img.url || img);
    } else if (result?.images && Array.isArray(result.images) && result.images.length > 0) {
      generatedImageUrls = result.images.map((img: any) => img.url || img);
    } else {
      throw new Error(`No images generated. Response keys: ${JSON.stringify(Object.keys(result || {}), null, 2)}`);
    }

    if (generatedImageUrls.length === 0) {
      throw new Error("No image URLs were generated");
    }

    return {
      imageUrls: generatedImageUrls,
      processingTimeMs: processingTime,
    };
  }
}
