import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect, data } from "@remix-run/node";
import {useLoaderData, useSubmit, useActionData, useNavigate} from "@remix-run/react";
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
  RadioButton, Page,
} from "@shopify/polaris";
import { TitleBar, SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useCallback, useEffect, useState, useMemo } from "react";
import db from "../db.server";
import { aiStylesTable } from "../db/schema";
import { getShopId } from "../utils/getShopId";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import BreadcrumbLink from "app/components/BreadcrumbLink";

const AiStyleSchema = z.object({
  name: z.string().min(1, { error: "Style name is required" }),
  promptTemplate: z.string().min(1, { error: "Prompt template is required" }),
  exampleImageUrl: z.string().url({ error: "Please enter a valid URL" }).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof AiStyleSchema>;
type ActionData = {
  errors?: Record<string, string[]>;
  success?: boolean;
  deleted?: boolean;
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  if (!params.id) {
    throw new Response("Style UUID is required", { status: 400 });
  }

  const aiStyle = await db
    .select()
    .from(aiStylesTable)
    .where(and(
      eq(aiStylesTable.uuid, params.id),
      eq(aiStylesTable.shopId, shopId)
    ))
    .limit(1);

  if (!aiStyle.length) {
    throw new Response("Style not found", { status: 404 });
  }

  return {
    aiStyle: aiStyle[0],
  };
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  if (!params.id) {
    return data({ errors: { general: ["Style UUID is required"] } }, { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle delete action
  if (intent === "delete") {
    await db
      .delete(aiStylesTable)
      .where(and(
        eq(aiStylesTable.uuid, params.id),
        eq(aiStylesTable.shopId, shopId)
      ));

    return redirect("/app/styles");
  }

  // Handle update action
  const rawData = {
    name: formData.get("name"),
    promptTemplate: formData.get("promptTemplate"),
    exampleImageUrl: formData.get("exampleImageUrl"),
    isActive: formData.get("isActive") === "true",
  };

  const result = AiStyleSchema.safeParse(rawData);

  if (!result.success) {
    const fieldErrors: Record<string, string[]> = {};
    result.error.issues.forEach((issue) => {
      const path = issue.path.join('.');
      const field = path || 'root';
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(issue.message);
    });
    return data({ errors: fieldErrors }, { status: 400 });
  }

  const { name, promptTemplate, exampleImageUrl, isActive } = result.data;

  await db
    .update(aiStylesTable)
    .set({
      name,
      promptTemplate,
      exampleImageUrl: exampleImageUrl || null,
      isActive: isActive ?? false,
      updatedAt: new Date().toISOString(),
    })
    .where(and(
      eq(aiStylesTable.uuid, params.id),
      eq(aiStylesTable.shopId, shopId)
    ));

  return { success: true };
};

export default function EditStylePage() {
  const { aiStyle } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<FormValues | null>(null);
  const [isTestingGeneration, setIsTestingGeneration] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; imageUrl?: string; error?: string } | null>(null);
  const [selectedTestImage, setSelectedTestImage] = useState<'cat' | 'dog'>('cat');

  // Use App Bridge hook with SSR safety
  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;
  const navigate = useNavigate();

  // Set client flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  const { control, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset, watch } = useForm<FormValues>({
    resolver: zodResolver(AiStyleSchema),
    defaultValues: {
      name: aiStyle.name,
      promptTemplate: aiStyle.promptTemplate,
      exampleImageUrl: aiStyle.exampleImageUrl || '',
      isActive: aiStyle.isActive ?? false,
    },
  });

  // Watch all form values to detect changes
  const currentFormData = watch();

  // Calculate if form is truly dirty by comparing with last saved data
  const isFormDirty = useMemo(() => {
    if (!lastSavedData) return isDirty;

    return (
      currentFormData.name !== lastSavedData.name ||
      currentFormData.promptTemplate !== lastSavedData.promptTemplate ||
      currentFormData.exampleImageUrl !== lastSavedData.exampleImageUrl ||
      currentFormData.isActive !== lastSavedData.isActive
    );
  }, [currentFormData, lastSavedData, isDirty]);

  const onSubmit = useCallback((data: FormValues) => {
    setIsSaving(true);
    const formData = new FormData();
    formData.append("intent", "update");
    formData.append("name", data.name);
    formData.append("promptTemplate", data.promptTemplate);
    formData.append("exampleImageUrl", data.exampleImageUrl || '');
    formData.append("isActive", data.isActive ? "true" : "false");

    submit(formData, { method: 'post' });
  }, [submit, setIsSaving]);

  const handleSave = useCallback(() => {
    handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  const handleDiscard = useCallback(() => {
    const confirmed = window.confirm('Are you sure you want to discard your changes?');
    if (confirmed) {
      const originalData = {
        name: aiStyle.name,
        promptTemplate: aiStyle.promptTemplate,
        exampleImageUrl: aiStyle.exampleImageUrl || '',
        isActive: aiStyle.isActive ?? false,
      };
      reset(originalData);
      setLastSavedData(originalData);
    }
  }, [reset, aiStyle]);

  const handleDelete = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "delete");
    submit(formData, { method: 'post' });
  }, [submit]);

  const toggleDeleteModal = useCallback(() => {
    setIsDeleteModalOpen((active) => !active);
  }, []);



  // Initialize last saved data on mount
  useEffect(() => {
    setLastSavedData({
      name: aiStyle.name,
      promptTemplate: aiStyle.promptTemplate,
      exampleImageUrl: aiStyle.exampleImageUrl || '',
      isActive: aiStyle.isActive ?? false,
    });
  }, [aiStyle]);

  // Show/hide save bar based on clean dirty state calculation
  useEffect(() => {
    if (shopify) {
      if (isFormDirty && !isSaving) {
        shopify.saveBar.show('style-edit-save-bar');
      } else {
        shopify.saveBar.hide('style-edit-save-bar');
      }
    }
  }, [isFormDirty, isSaving, shopify]);

  // Handle successful save
  useEffect(() => {
    if (actionData?.success && isSaving && shopify) {
      // Show success toast
      shopify.toast.show('Style updated successfully!', {
        duration: 3000,
      });

      // Update last saved data to current form data
      setLastSavedData(currentFormData);

      // Clear saving state
      setIsSaving(false);
    }
  }, [actionData?.success, isSaving, currentFormData, shopify]);

  // Handle save errors
  useEffect(() => {
    if (actionData?.errors && isSaving) {
      setIsSaving(false);
    }
  }, [actionData?.errors, isSaving]);

  const handleTestGeneration = useCallback(async () => {
    setIsTestingGeneration(true);
    setTestResult(null);

    try {
      const formData = new FormData();
      formData.append("intent", "test-generation");
      formData.append("promptTemplate", currentFormData.promptTemplate);
      formData.append("styleName", currentFormData.name);
      formData.append("testImageType", selectedTestImage);

      const response = await fetch(`/app/styles/${aiStyle.uuid}/test-generation`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({ success: true, imageUrl: result.imageUrl });
        if (shopify) {
          shopify.toast.show('Test generation completed!', { duration: 3000 });
        }
      } else {
        setTestResult({ success: false, error: result.error || 'Generation failed' });
        if (shopify) {
          shopify.toast.show('Test generation failed', { duration: 3000, isError: true });
        }
      }
    } catch (error) {
      console.error('Test generation error:', error);
      setTestResult({ success: false, error: 'Network error occurred' });
      if (shopify) {
        shopify.toast.show('Test generation failed', { duration: 3000, isError: true });
      }
    } finally {
      setIsTestingGeneration(false);
    }
  }, [currentFormData, aiStyle.uuid, shopify, selectedTestImage]);

  return (
    <Page title={`${aiStyle.name}`}
          backAction={{
            content: 'Styles',
            onAction: () => navigate('/app/styles'),
          }}
    >
      <TitleBar title={`${aiStyle.name}`}>
        <BreadcrumbLink to="/app/styles">
          Styles
        </BreadcrumbLink>
      </TitleBar>

      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <form onSubmit={handleSubmit(onSubmit)}>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    Edit AI Style
                  </Text>

                  <FormLayout>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Style Name"
                          autoComplete="off"
                          helpText="A descriptive name for the AI style (e.g., 'Vintage Comic Book')."
                          error={errors.name?.message || actionData?.errors?.name?.[0]}
                        />
                      )}
                    />

                    <Controller
                      name="promptTemplate"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Prompt Template"
                          autoComplete="off"
                          multiline={6}
                          helpText="The main AI prompt. Use placeholders like {subject} where the user's input will be injected."
                          error={errors.promptTemplate?.message || actionData?.errors?.promptTemplate?.[0]}
                        />
                      )}
                    />

                    <Controller
                      name="exampleImageUrl"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Example Image URL"
                          autoComplete="off"
                          helpText="Optional: A URL to an image that showcases this style."
                          error={errors.exampleImageUrl?.message || actionData?.errors?.exampleImageUrl?.[0]}
                        />
                      )}
                    />

                    <BlockStack gap="200">

                  </BlockStack>
                  </FormLayout>
                </BlockStack>
              </Card>
            </form>
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
                    Status: <Badge tone={aiStyle.isActive ? "success" : undefined}>{aiStyle.isActive ? "Active" : "Draft"}</Badge>
                  </Text>
                </BlockStack>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field: { value, onChange, ...field } }) => (
                    <Checkbox
                      {...field}
                      label="Active"
                      checked={value}
                      onChange={onChange}
                      helpText="Active styles are available for customers to choose from."
                    />
                  )}
                />

                <BlockStack gap="200">
                  <Text as="span" variant="bodyMd" tone="subdued">
                    Created: {new Date(aiStyle.createdAt).toLocaleDateString()}
                  </Text>
                  {aiStyle.updatedAt && (
                    <Text as="span" variant="bodyMd" tone="subdued">
                      Updated: {new Date(aiStyle.updatedAt).toLocaleDateString()}
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
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Test AI Generation
                </Text>

                <Text variant="bodyMd" as="p" tone="subdued">
                  Test your prompt template with a sample image to see how it performs. We're using FLUX Kontext for high-quality image-to-image transformations.
                </Text>

                <Layout>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="400">
                      <Text as="h4" variant="headingSm">
                        Select Test Image
                      </Text>

                      <BlockStack gap="300">
                        <InlineStack gap="200" align="start">
                          <RadioButton
                            label=""
                            id="cat-image"
                            name="testImage"
                            checked={selectedTestImage === 'cat'}
                            onChange={() => setSelectedTestImage('cat')}
                          />
                          <BlockStack gap="200">
                            <Text variant="bodyMd" as="p">Cat</Text>
                            <Thumbnail
                              source="https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/A-Cat.jpg/1600px-A-Cat.jpg?20101227100718"
                              alt="Test cat image"
                              size="medium"
                            />
                          </BlockStack>
                        </InlineStack>

                        <InlineStack gap="200" align="start">
                          <RadioButton
                            label=""
                            id="dog-image"
                            name="testImage"
                            checked={selectedTestImage === 'dog'}
                            onChange={() => setSelectedTestImage('dog')}
                          />
                          <BlockStack gap="200">
                            <Text variant="bodyMd" as="p">Dog</Text>
                            <Thumbnail
                              source="https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Labrador_Retriever_portrait.jpg/960px-Labrador_Retriever_portrait.jpg"
                              alt="Test dog image"
                              size="medium"
                            />
                          </BlockStack>
                        </InlineStack>
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>

                  <Layout.Section>
                    <BlockStack gap="400">
                      <Button
                        variant="primary"
                        onClick={handleTestGeneration}
                        loading={isTestingGeneration}
                        disabled={isTestingGeneration || !currentFormData.promptTemplate}
                      >
                        {isTestingGeneration ? 'Generating (~8s)...' : 'Test Current Prompt'}
                      </Button>

                      {isTestingGeneration && (
                        <Banner>
                          <InlineStack gap="200" align="center">
                            <Spinner size="small" />
                            <Text as="span">Generating test image using FLUX Kontext model (typically takes ~8 seconds)...</Text>
                          </InlineStack>
                        </Banner>
                      )}

                      {testResult && (
                        <div>
                          {testResult.success ? (
                            <BlockStack gap="300">
                              <Banner tone="success">
                                Test generation completed successfully!
                              </Banner>
                              {testResult.imageUrl && (
                                <BlockStack gap="300">
                                  <Text as="h4" variant="headingSm">
                                    Generated Result
                                  </Text>
                                  <div style={{ maxWidth: '400px' }}>
                                    <img
                                      src={testResult.imageUrl}
                                      alt="Generated test result"
                                      style={{
                                        width: '100%',
                                        height: 'auto',
                                        borderRadius: '8px',
                                        border: '1px solid #e1e3e5'
                                      }}
                                    />
                                  </div>
                                  <Text variant="bodySm" as="p" tone="subdued">
                                    Generated using current prompt template with {selectedTestImage} image
                                  </Text>

                                  <InlineStack gap="200">
                                    <Button
                                      variant="secondary"
                                      onClick={() => {
                                        // Update the form field with the generated image URL
                                        reset({
                                          ...currentFormData,
                                          exampleImageUrl: testResult.imageUrl
                                        });
                                        if (shopify) {
                                          shopify.toast.show('Example image URL updated with generated result!', { duration: 3000 });
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
                                      Open in New Tab
                                    </Button>
                                  </InlineStack>
                                </BlockStack>
                              )}
                            </BlockStack>
                          ) : (
                            <Banner tone="critical">
                              Test generation failed: {testResult.error}
                            </Banner>
                          )}
                        </div>
                      )}
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Native Shopify SaveBar - replaces Polaris buttons */}
      <SaveBar id="style-edit-save-bar">
        <button
          variant="primary"
          onClick={handleSave}
          loading={isSubmitting ? "" : undefined}
          disabled={isSubmitting}
        >
          Save Style
        </button>
        <button
          onClick={handleDiscard}
          disabled={isSubmitting}
        >
          Discard
        </button>
      </SaveBar>

      <Modal
        open={isDeleteModalOpen}
        onClose={toggleDeleteModal}
        title="Delete AI Style"
        primaryAction={{
          content: 'Delete',
          onAction: handleDelete,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: toggleDeleteModal,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete "{aiStyle.name}"? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
