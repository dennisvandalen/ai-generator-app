import type { ActionFunctionArgs } from "@remix-run/node";

import { authenticate } from "../shopify.server";
import { fal } from "@fal-ai/client";
import { getShopId } from "../utils/getShopId";
import db from "../db.server";
import { aiStylesTable } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  if (!params.id) {
    return Response.json({ error: "Style UUID is required" }, { status: 400 });
  }

  // Configure FAL client
  fal.config({
    credentials: process.env.FAL_KEY,
  });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "test-generation") {
    return Response.json({ error: "Invalid intent" }, { status: 400 });
  }

  const promptTemplate = formData.get("promptTemplate") as string;
  const testImageType = formData.get("testImageType") as string || "cat";

  if (!promptTemplate) {
    return Response.json({ error: "Prompt template is required" }, { status: 400 });
  }

  try {
    // Get the AI style record to verify it exists and belongs to this shop
    const aiStyle = await db
      .select()
      .from(aiStylesTable)
      .where(and(
        eq(aiStylesTable.uuid, params.id),
        eq(aiStylesTable.shopId, shopId)
      ))
      .limit(1);

    if (!aiStyle.length) {
      return Response.json({ error: "Style not found" }, { status: 404 });
    }

    // Generate a test prompt by replacing placeholders
    const testSubject = testImageType === "dog" ? "dog" : "cat";
    const finalPrompt = promptTemplate.replace(/\{subject\}/g, testSubject);

    console.log("Starting FAL AI test generation with prompt:", finalPrompt);

    const startTime = Date.now();

    // Use the selected test image URL
    const inputImageUrl = testImageType === "dog"
      ? "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Labrador_Retriever_portrait.jpg/960px-Labrador_Retriever_portrait.jpg"
      : "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/A-Cat.jpg/1600px-A-Cat.jpg?20101227100718";

    // Use FAL AI FLUX Pro Kontext model for image transformation
    const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: {
        prompt: finalPrompt,
        image_url: inputImageUrl,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: "png",
        aspect_ratio: "1:1",
        strength: 0.85,
      },
    }) as any;

    const processingTime = Date.now() - startTime;

    console.log("FLUX Pro Kontext Test Generation Response:", JSON.stringify(result, null, 2));

    // Handle the response structure for FLUX Pro Kontext
    let generatedImageUrl: string | null = null;

    if (result?.data?.images && Array.isArray(result.data.images) && result.data.images.length > 0) {
      generatedImageUrl = result.data.images[0].url || result.data.images[0];
    } else if (result?.images && Array.isArray(result.images) && result.images.length > 0) {
      generatedImageUrl = result.images[0].url || result.images[0];
    } else {
      console.error("Unexpected response structure from FLUX Pro Kontext:", result);
      throw new Error(`No images generated. Response keys: ${JSON.stringify(Object.keys(result || {}), null, 2)}`);
    }

    if (!generatedImageUrl) {
      throw new Error("No image URL was generated");
    }

    // Update usage count for the AI style (but don't track test generations in main database)
    const currentStyle = aiStyle[0];
    if (currentStyle) {
      await db
        .update(aiStylesTable)
        .set({
          usageCount: (currentStyle.usageCount || 0) + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(aiStylesTable.id, currentStyle.id));
    }

    console.log(`Test generation completed successfully! Generated image: ${generatedImageUrl}`);

    return Response.json({
      success: true,
      imageUrl: generatedImageUrl,
      processingTimeMs: processingTime,
      prompt: finalPrompt,
      message: "Test generation completed successfully using FLUX Kontext",
    });

  } catch (error) {
    console.error("Test generation error:", error);

    return Response.json({
      error: error instanceof Error ? error.message : "Failed to generate test image",
      success: false,
    }, { status: 500 });
  }
};
