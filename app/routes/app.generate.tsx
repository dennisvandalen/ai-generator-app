import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  TextField,
  InlineStack,
  Spinner,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { fal } from "@fal-ai/client";
import { authenticate } from "../shopify.server";

// Type definitions
type GenerationResponse = {
  success: true;
  images: string[];
  prompt: string;
  generatedAt: string;
} | {
  error: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  await authenticate.admin(request);
  
  // Configure FAL client (server-side only)
  fal.config({
    credentials: process.env.FAL_KEY,
  });
  
  const formData = await request.formData();
  const prompt = formData.get("prompt") as string;
  const numImages = parseInt(formData.get("numImages") as string) || 1;
  
  if (!prompt) {
    return json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    console.log("Starting FAL AI generation with prompt:", prompt);
    
    // TODO: Replace with actual uploaded pet image URL
    const imageUrl = "https://placecats.com/300/200"; // Temporary placeholder
    
    // Use FAL AI FLUX Pro Kontext model for image transformation
    const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: {
        prompt: prompt,
        image_url: imageUrl,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: numImages,
        enable_safety_checker: true,
        output_format: "png",
        aspect_ratio: "1:1",
        strength: 0.85,
      },
    }) as any;

    console.log("FLUX Pro Kontext API Response:", JSON.stringify(result, null, 2));

    // Handle the response structure for FLUX Pro Kontext
    let images: string[] = [];

    if (result?.data?.images && Array.isArray(result.data.images)) {
      images = result.data.images.map((img: any) => img.url || img);
    } else if (result?.images && Array.isArray(result.images)) {
      images = result.images.map((img: any) => img.url || img);
    } else {
      console.error("Unexpected response structure from FLUX Pro Kontext:", result);
      throw new Error(`No images generated. Response keys: ${JSON.stringify(Object.keys(result || {}), null, 2)}`);
    }

    if (images.length === 0) {
      throw new Error("No images were generated");
    }

    console.log(`Generated ${images.length} images successfully with FLUX Pro Kontext!`);
    
    return json({
      success: true as const,
      images: images,
      prompt: prompt,
      generatedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("Generation error:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to generate images" 
    }, { status: 500 });
  }
};

export default function Generate() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  
  const [prompt, setPrompt] = useState("");
  const [numImages, setNumImages] = useState("1");

  const isLoading = fetcher.state === "submitting";
  const generationData = fetcher.data;

  useEffect(() => {
    if (generationData?.success) {
      shopify.toast.show(`Successfully generated ${generationData.images.length} images!`);
    } else if (generationData?.error) {
      shopify.toast.show(`Generation failed: ${generationData.error}`, { isError: true });
    }
  }, [generationData, shopify]);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      shopify.toast.show("Please enter a prompt", { isError: true });
      return;
    }
    
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("numImages", numImages);
    
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <Page>
      <TitleBar title="AI Pet Print Generator" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Generate AI Pet Prints
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Create beautiful, custom posters of your pets using AI. Enter a description of how you'd like your pet to be transformed and our AI will create stunning artwork.
                  </Text>
                  
                  <BlockStack gap="300">
                    <TextField
                      label="Generation Prompt"
                      value={prompt}
                      onChange={setPrompt}
                      placeholder="e.g., transform this cat into a majestic lion in a forest setting"
                      helpText="Describe how you want the pet image to be transformed"
                      multiline={3}
                      autoComplete="off"
                    />
                    
                    <TextField
                      label="Number of Images"
                      type="number"
                      value={numImages}
                      onChange={setNumImages}
                      min="1"
                      max="4"
                      helpText="Generate 1-4 images (more images take longer)"
                      autoComplete="off"
                    />
                    
                    <InlineStack align="start">
                      <Button
                        variant="primary"
                        size="large"
                        onClick={handleGenerate}
                        loading={isLoading}
                        disabled={!prompt.trim()}
                      >
                        {isLoading ? "Generating..." : "Generate Pet Print"}
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Loading State */}
              {isLoading && (
                <Card>
                  <BlockStack gap="300" align="center">
                    <Spinner size="large" />
                    <Text as="h3" variant="headingMd">
                      Generating your AI pet print...
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      This may take 30-60 seconds. Please don't refresh the page.
                    </Text>
                  </BlockStack>
                </Card>
              )}

              {/* Error State */}
              {generationData?.error && (
                <Banner tone="critical">
                  <Text as="p">
                    Generation failed: {generationData.error}
                  </Text>
                </Banner>
              )}

              {/* Success State - Generated Images */}
              {generationData?.success && generationData.images && (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Generated Images
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Prompt: "{generationData.prompt}"
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Generated at: {new Date(generationData.generatedAt).toLocaleString()}
                    </Text>
                    
                    <Layout>
                      {generationData.images.map((imageUrl: string, index: number) => (
                        <Layout.Section key={index} variant={generationData.images.length === 1 ? "oneHalf" : "oneThird"}>
                          <Card>
                            <BlockStack gap="300">
                              <Box
                                borderWidth="025"
                                borderRadius="300"
                                borderColor="border"
                                background="bg-surface-secondary"
                                padding="400"
                              >
                                <img 
                                  src={imageUrl} 
                                  alt={`Generated pet print ${index + 1}`}
                                  style={{ 
                                    width: "100%", 
                                    height: "auto",
                                    borderRadius: "8px"
                                  }}
                                />
                              </Box>
                              <InlineStack gap="200">
                                <Button
                                  url={imageUrl}
                                  target="_blank"
                                  variant="secondary"
                                  size="slim"
                                >
                                  View Full Size
                                </Button>
                                <Button
                                  onClick={() => {
                                    navigator.clipboard.writeText(imageUrl);
                                    shopify.toast.show("Image URL copied to clipboard");
                                  }}
                                  variant="secondary"
                                  size="slim"
                                >
                                  Copy URL
                                </Button>
                              </InlineStack>
                            </BlockStack>
                          </Card>
                        </Layout.Section>
                      ))}
                    </Layout>
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>

          {/* Sidebar with info */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    How it works
                  </Text>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p">
                      1. Enter a creative prompt describing how you want to transform the pet image
                    </Text>
                    <Text variant="bodyMd" as="p">
                      2. Choose how many variations you'd like (1-4 images)
                    </Text>
                    <Text variant="bodyMd" as="p">
                      3. Click "Generate" and wait for the AI to create your custom pet prints
                    </Text>
                    <Text variant="bodyMd" as="p">
                      4. Download or copy the generated images to use in your store
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Tips for better results
                  </Text>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p">
                      • Be specific about the style you want (realistic, cartoon, watercolor, etc.)
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Describe the setting or background you envision
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Mention lighting conditions for dramatic effects
                    </Text>
                    <Text variant="bodyMd" as="p">
                      • Try different artistic styles like "oil painting" or "digital art"
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>


            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
} 