import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import {
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  InlineStack,
  Badge,
  FormLayout,
  TextField,
  Thumbnail,
  Checkbox,
  Modal,
  Spinner,
  Banner,
  RadioButton,
  Page,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "~/shopify.server";
import { useCallback, useEffect, useState } from "react";
import db from "../db.server";
import { aiStylesTable } from "~/db/schema";
import { getShopId } from "~/utils/getShopId";
import { eq, and } from "drizzle-orm";
import BreadcrumbLink from "app/components/BreadcrumbLink";

// React Hook Form imports
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema and action imports
import { AiStyleFormSchema, type AiStyleFormData } from "~/schemas/aiStyle";
import { createActionRouter } from "~/utils/createActionRouter";
import { RHFFormSaveBar } from "~/components/RHFFormSaveBar";

// Import server-side action handlers
import * as updateStyle from "~/actions/styles/update";
import * as deleteStyle from "~/actions/styles/delete";
import {boundary} from "@shopify/shopify-app-remix/server";

// Define types for fetcher data
interface FormFetcherData {
  error?: string;
  updated?: boolean;
  deleted?: boolean;
  details?: Array<{ field: string; message: string }>;
}

interface TestFetcherData {
  success?: boolean;
  imageUrl?: string;
  error?: string;
}


// Wire up the action router
export const action = createActionRouter({
  "update-style": updateStyle.action,
  "delete-style": deleteStyle.action,
});

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  if (!params.id) {
    throw new Response("Style UUID is required", { status: 400 });
  }

  const aiStyle = await db
    .select()
    .from(aiStylesTable)
    .where(
      and(eq(aiStylesTable.uuid, params.id), eq(aiStylesTable.shopId, shopId))
    )
    .limit(1);

  if (!aiStyle.length) {
    throw new Response("Style not found", { status: 404 });
  }

  return json({
    aiStyle: aiStyle[0],
  });
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function EditStylePage() {
  const { aiStyle } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const formFetcher = useFetcher<FormFetcherData>(); // For form submissions (save/delete)
  const testFetcher = useFetcher<TestFetcherData>(); // For test generation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTestingGeneration, setIsTestingGeneration] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    imageUrl?: string;
    error?: string;
  } | null>(null);
  const [selectedTestImage, setSelectedTestImage] = useState<"cat" | "dog">(
    "cat"
  );

  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // React Hook Form setup
  const form = useForm<AiStyleFormData>({
    resolver: zodResolver(AiStyleFormSchema),
    mode: 'onChange', // Enable real-time validation
  });

  // Initialize form when loader data is available
  useEffect(() => {
    if (aiStyle) {
      form.reset({
        id: aiStyle.uuid,
        name: aiStyle.name,
        promptTemplate: aiStyle.promptTemplate,
        exampleImageUrl: aiStyle.exampleImageUrl || "",
        isActive: aiStyle.isActive ?? false,
      });
    }
  }, [aiStyle, form]);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    watch,
    setValue,
    reset,
  } = form;

  // Watch form data for reactive updates
  const formData = watch();
  const promptTemplate = watch('promptTemplate');


  // Direct handler for RHFFormSaveBar
  const handleSave = (data: AiStyleFormData) => {
    const submitData = { ...data, _action: "update-style" };
    formFetcher.submit(submitData, { method: "post", encType: "application/json" });
  };

  // Handle form submission response
  useEffect(() => {
    if (formFetcher.state === 'idle' && formFetcher.data) {
      const isSuccess = !formFetcher.data.error;

      if (isSuccess && formFetcher.data.updated) {
        // Reset form with new values to clear isDirty state
        reset(formData);
        shopify?.toast.show("Style saved");
      } else if (formFetcher.data.error) {
        // Handle server validation errors
        if (formFetcher.data.details && Array.isArray(formFetcher.data.details)) {
          formFetcher.data.details.forEach((detail: { field: string; message: string }) => {
            form.setError(detail.field as keyof AiStyleFormData, {
              message: detail.message
            });
          });
        }
        console.error("Save failed:", formFetcher.data.error);
        shopify?.toast.show(formFetcher.data.error, { isError: true });
      }
    }
  }, [formFetcher.state, formFetcher.data, shopify, reset, formData, form]);

  const handleDelete = useCallback(() => {
    const data = { _action: "delete-style", id: aiStyle.uuid };
    formFetcher.submit(data, { method: "post", encType: "application/json" });
  }, [aiStyle.uuid, formFetcher]);

  useEffect(() => {
    if (formFetcher.state === 'idle' && formFetcher.data?.deleted) {
      navigate('/app/styles');
    }
  }, [formFetcher.state, formFetcher.data, navigate]);

  const toggleDeleteModal = useCallback(() => {
    setIsDeleteModalOpen((active) => !active);
  }, []);

  const handleTestGeneration = useCallback(() => {
    const testFormData = new FormData();
    testFormData.append("promptTemplate", promptTemplate || "");
    testFormData.append("testImageType", selectedTestImage);

    testFetcher.submit(testFormData, {
      method: "post",
      action: `/api/test-generation/${aiStyle.uuid}`
    });
  }, [promptTemplate, selectedTestImage, testFetcher, aiStyle.uuid]);

  useEffect(() => {
    if (testFetcher.state === 'submitting') {
      setIsTestingGeneration(true);
      setTestResult(null);
    } else if (testFetcher.state === 'idle' && testFetcher.data) {
      setIsTestingGeneration(false);
      if (testFetcher.data.success) {
        setTestResult({ success: true, imageUrl: testFetcher.data.imageUrl });
        if (shopify) {
          shopify.toast.show('Test generation completed!', { duration: 3000 });
        }
      } else if (testFetcher.data.error) {
        setTestResult({ success: false, error: testFetcher.data.error || 'Generation failed' });
        if (shopify) {
          shopify.toast.show('Test generation failed', { duration: 3000, isError: true });
        }
      }
    }
  }, [testFetcher.state, testFetcher.data, shopify]);

  return (
    <Page
      title={`${aiStyle.name}`}
      backAction={{
        content: "Styles",
        onAction: () => navigate("/app/styles"),
      }}
    >
      <TitleBar title={`${aiStyle.name}`}>
        <BreadcrumbLink to="/app/styles">Styles</BreadcrumbLink>
      </TitleBar>

      <RHFFormSaveBar
        form={form}
        onSave={handleSave}
        onDiscard={() => reset()}
      />

      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Edit AI Style
                </Text>

                <FormLayout>
                  <TextField
                    label="Style Name"
                    value={formData.name || ""}
                    onChange={(value) => setValue("name", value, { shouldDirty: true })}
                    error={errors.name?.message}
                    autoComplete="off"
                    helpText="A descriptive name for the AI style (e.g., 'Vintage Comic Book')."
                  />

                  <TextField
                    label="Prompt Template"
                    value={formData.promptTemplate || ""}
                    onChange={(value) => setValue("promptTemplate", value, { shouldDirty: true })}
                    error={errors.promptTemplate?.message}
                    autoComplete="off"
                    multiline={6}
                    helpText="The main AI prompt. Use placeholders like {subject} where the user's input will be injected."
                  />

                  <TextField
                    label="Example Image URL"
                    value={formData.exampleImageUrl || ""}
                    onChange={(value) => setValue("exampleImageUrl", value, { shouldDirty: true })}
                    error={errors.exampleImageUrl?.message}
                    autoComplete="off"
                    helpText="Optional: A URL to an image that showcases this style."
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Style Preview
                </Text>

                {aiStyle.exampleImageUrl && (
                  <Thumbnail
                    source={aiStyle.exampleImageUrl}
                    alt={aiStyle.name}
                    size="large"
                  />
                )}

                <BlockStack gap="200">
                  <Text as="span" variant="bodyMd" tone="subdued">
                    Status:{" "}
                    <Badge tone={formData.isActive ? "success" : undefined}>
                      {formData.isActive ? "Active" : "Draft"}
                    </Badge>
                  </Text>
                </BlockStack>
                <Checkbox
                  label="Active"
                  checked={formData.isActive}
                  onChange={(checked) => setValue("isActive", checked, { shouldDirty: true })}
                  helpText="Active styles are available for customers to choose from."
                />

                <BlockStack gap="200">
                  <Text as="span" variant="bodyMd" tone="subdued">
                    Created: {new Date(aiStyle.createdAt).toLocaleDateString()}
                  </Text>
                  {aiStyle.updatedAt && (
                    <Text as="span" variant="bodyMd" tone="subdued">
                      Updated:{" "}
                      {new Date(aiStyle.updatedAt).toLocaleDateString()}
                    </Text>
                  )}
                </BlockStack>

                <InlineStack gap="300">
                  <Button
                    variant="primary"
                    tone="critical"
                    onClick={toggleDeleteModal}
                  >
                    Delete Style
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Test Generation Section */}
        <Card>
          <BlockStack gap="500">
            <BlockStack gap="300">
              <InlineStack gap="200" align="space-between">
                <Text as="h3" variant="headingMd">
                  Test AI Generation
                </Text>
                <Badge tone="info">FLUX Kontext</Badge>
              </InlineStack>

              <Text variant="bodyMd" as="p" tone="subdued">
                Test your prompt template with a sample image to preview how it performs.
                Choose an input image below and click "Test Current Prompt" to see the transformation.
              </Text>
            </BlockStack>

            <Layout>
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h4" variant="headingSm">
                      Input Image Selection
                    </Text>

                    <BlockStack gap="400">
                      <div
                        style={{
                          padding: "12px",
                          border: selectedTestImage === "cat" ? "2px solid #008060" : "1px solid #e1e3e5",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor: selectedTestImage === "cat" ? "#f6f8fa" : "transparent"
                        }}
                        onClick={() => setSelectedTestImage("cat")}
                      >
                        <InlineStack gap="300" align="start">
                          <RadioButton
                            label=""
                            id="cat-image"
                            name="testImage"
                            checked={selectedTestImage === "cat"}
                            onChange={() => setSelectedTestImage("cat")}
                          />
                          <BlockStack gap="200">
                            <Text variant="bodyMd" as="p" fontWeight="medium">
                              Cat Portrait
                            </Text>
                            <Thumbnail
                              source="https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/A-Cat.jpg/1600px-A-Cat.jpg?20101227100718"
                              alt="Test cat image"
                              size="medium"
                            />
                          </BlockStack>
                        </InlineStack>
                      </div>

                      <div
                        style={{
                          padding: "12px",
                          border: selectedTestImage === "dog" ? "2px solid #008060" : "1px solid #e1e3e5",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor: selectedTestImage === "dog" ? "#f6f8fa" : "transparent"
                        }}
                        onClick={() => setSelectedTestImage("dog")}
                      >
                        <InlineStack gap="300" align="start">
                          <RadioButton
                            label=""
                            id="dog-image"
                            name="testImage"
                            checked={selectedTestImage === "dog"}
                            onChange={() => setSelectedTestImage("dog")}
                          />
                          <BlockStack gap="200">
                            <Text variant="bodyMd" as="p" fontWeight="medium">
                              Dog Portrait
                            </Text>
                            <Thumbnail
                              source="https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Labrador_Retriever_portrait.jpg/960px-Labrador_Retriever_portrait.jpg"
                              alt="Test dog image"
                              size="medium"
                            />
                          </BlockStack>
                        </InlineStack>
                      </div>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack gap="200" align="space-between">
                      <Text as="h4" variant="headingSm">
                        Generation Controls
                      </Text>
                      {promptTemplate && (
                        <Badge tone="success">Prompt Ready</Badge>
                      )}
                    </InlineStack>

                    <Button
                      variant="primary"
                      size="large"
                      onClick={handleTestGeneration}
                      loading={isTestingGeneration}
                      disabled={isTestingGeneration || !promptTemplate}
                      fullWidth
                    >
                      {isTestingGeneration
                        ? "Generating (~8s)..."
                        : "Test Current Prompt"}
                    </Button>

                    {!promptTemplate && (
                      <Banner tone="warning">
                        Please enter a prompt template above before testing.
                      </Banner>
                    )}

                    {isTestingGeneration && (
                      <Banner tone="info">
                        <InlineStack gap="200" align="center">
                          <Spinner size="small" />
                          <BlockStack gap="100">
                            <Text as="span" fontWeight="medium">
                              AI generation in progress...
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              Using FLUX Kontext model (typically takes ~8 seconds)
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Banner>
                    )}

                    {testResult && (
                      <BlockStack gap="400">
                        {testResult.success ? (
                          <BlockStack gap="400">
                            <Banner tone="success">
                              <Text as="span" fontWeight="medium">
                                Test generation completed successfully!
                              </Text>
                            </Banner>

                            {testResult.imageUrl && (
                              <Card>
                                <BlockStack gap="400">
                                  <InlineStack gap="200" align="space-between">
                                    <Text as="h5" variant="headingSm">
                                      Generated Result
                                    </Text>
                                    <Badge>
                                      {`${selectedTestImage[0].toUpperCase()}${selectedTestImage.slice(1)} → AI Style`}
                                    </Badge>
                                  </InlineStack>

                                  <div style={{
                                    maxWidth: "100%",
                                    display: "flex",
                                    justifyContent: "center",
                                    padding: "16px",
                                    backgroundColor: "#f9f9f9",
                                    borderRadius: "8px"
                                  }}>
                                    <img
                                      src={testResult.imageUrl}
                                      alt="Generated test result"
                                      style={{
                                        maxWidth: "400px",
                                        width: "100%",
                                        height: "auto",
                                        borderRadius: "8px",
                                        border: "1px solid #e1e3e5",
                                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                                      }}
                                    />
                                  </div>

                                  <Text variant="bodySm" as="p" tone="subdued" alignment="center">
                                    Generated using your prompt template with the {selectedTestImage} input image
                                  </Text>

                                  <InlineStack gap="200" align="center">
                                    <Button
                                      variant="secondary"
                                      onClick={() => {
                                        setValue("exampleImageUrl", testResult.imageUrl || "", { shouldDirty: true });
                                        if (shopify) {
                                          shopify.toast.show(
                                            "Example image URL updated with generated result!",
                                            { duration: 3000 }
                                          );
                                        }
                                      }}
                                    >
                                      Use as Example Image
                                    </Button>
                                    <Button
                                      variant="plain"
                                      url={testResult.imageUrl}
                                      target="_blank"
                                    >
                                      Open Full Size
                                    </Button>
                                  </InlineStack>
                                </BlockStack>
                              </Card>
                            )}
                          </BlockStack>
                        ) : (
                          <Banner tone="critical">
                            <BlockStack gap="200">
                              <Text as="span" fontWeight="medium">
                                Test generation failed
                              </Text>
                              <Text as="span" variant="bodySm">
                                {testResult.error}
                              </Text>
                            </BlockStack>
                          </Banner>
                        )}
                      </BlockStack>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Card>
      </BlockStack>

      <Modal
        open={isDeleteModalOpen}
        onClose={toggleDeleteModal}
        title="Delete AI Style"
        primaryAction={{
          content: "Delete",
          onAction: handleDelete,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: toggleDeleteModal,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete "{aiStyle.name}"? This action cannot
            be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
