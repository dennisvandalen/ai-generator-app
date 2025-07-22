import { type ActionFunctionArgs  } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { AIGenerationService } from "~/services/aiGenerationService";
import { getShopId } from "~/utils/getShopId";
import db from "../db.server";
import { aiStylesTable, generationsTable, productsTable } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';

// POST /api/generations
export const action = async ({ request }: ActionFunctionArgs) => {
  // Shopify App Proxy authentication
  let session;
  try {
    const auth = await authenticate.public.appProxy(request);
    session = auth.session;
    if (!session) {
      return Response.json({
        success: false,
        error: "Unauthorized - Shopify authentication failed",
        message: "No session returned from authentication"
      }, { status: 401 });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: "Unauthorized - Shopify authentication failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { styleId, imageUrl, productId: shopifyProductId } = body;
    if (!styleId || !imageUrl || !shopifyProductId) {
      return Response.json({ error: "Missing styleId, imageUrl, or productId" }, { status: 400 });
    }

    // Get shopId from session
    const shopId = getShopId(session.shop);

    // Fetch the product from the database
    const product = await db
      .select()
      .from(productsTable)
      .where(and(
        eq(productsTable.shopifyProductId, shopifyProductId),
        eq(productsTable.shopId, shopId)
      ))
      .limit(1);

    if (!product.length) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }
    const productId = product[0].id;

    const aiStyle = await db
      .select()
      .from(aiStylesTable)
      .where(and(
        eq(aiStylesTable.uuid, styleId),
        eq(aiStylesTable.shopId, shopId)
      ))
      .limit(1);

    if (!aiStyle.length) {
      return Response.json({ error: "Style not found" }, { status: 404 });
    }

    const style = aiStyle[0];
    const promptTemplate = style.promptTemplate;
    const styleName = style.name;

    // Generate prompt (replace {subject} with 'product' or similar)
    const finalPrompt = promptTemplate.replace(/\{subject\}/g, "product");

    const aiService = new AIGenerationService();
    const { imageUrls: generatedImageUrls, processingTimeMs: processingTime } = await aiService.generateImage({
      prompt: finalPrompt,
      imageUrl: imageUrl,
      numImages: 2,
      styleImageUrl: style.exampleImageUrl || "",
    });

    if (generatedImageUrls.length === 0) {
      throw new Error("No image URLs were generated");
    }

    const now = new Date().toISOString();
    const generations = [];

    for (const generatedImageUrl of generatedImageUrls) {
      const generationId = uuidv4();
      await db.insert(generationsTable).values({
        id: generationId,
        shopId: shopId,
        productId: productId,
        aiStyleId: style.id,
        inputImageUrl: imageUrl,
        previewImageUrl: generatedImageUrl, // Store each generated image as its own preview
        generationType: "preview",
        status: "completed",
        aiPromptUsed: finalPrompt,
        processingTimeMs: processingTime,
        aiModelUsed: "fal-ai/flux-pro/kontext",
        createdAt: now,
        updatedAt: now,
      });
      generations.push({ generationId, imageUrl: generatedImageUrl });
    }

    // Update usage count for the AI style
    await db
      .update(aiStylesTable)
      .set({
        usageCount: (style.usageCount || 0) + 1,
        updatedAt: now,
      })
      .where(eq(aiStylesTable.id, style.id));

    return Response.json({
      success: true,
      generations: generations, // Return an array of generation objects
      processingTimeMs: processingTime,
      styleId,
      styleName,
      inputImageUrl: imageUrl,
      message: "AI generation completed successfully using FLUX Kontext",
    });
  } catch (error: any) {
    console.error("Generation error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to generate image", success: false }, { status: 500 });
  }
};
