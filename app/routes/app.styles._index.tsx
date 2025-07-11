import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, Link } from "@remix-run/react";
import {
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  InlineStack,
  EmptyState,
  Badge,
  Modal,
  FormLayout,
  TextField,
  IndexTable,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useState, useCallback, useEffect } from "react";
import db from "../db.server";
import { aiStylesTable } from "../db/schema";
import { getShopId } from "../utils/getShopId";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TitleBar } from "@shopify/app-bridge-react";
import { HoverImagePreview } from "../components/HoverImagePreview";
import { ImageModal } from "../components/ImageModal";

const AiStyleSchema = z.object({
  name: z.string().min(1, { message: "Style name is required" }),
  promptTemplate: z.string().min(1, { message: "Prompt template is required" }),
  exampleImageUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof AiStyleSchema>;
type ActionData = {
  errors?: z.ZodError<FormValues>['formErrors']['fieldErrors'];
  success?: boolean;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  const styles = await db
    .select()
    .from(aiStylesTable)
    .where(eq(aiStylesTable.shopId, shopId));

  return json({
    aiStyles: styles,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  const formData = await request.formData();
  const rawData = Object.fromEntries(formData);
  const result = AiStyleSchema.safeParse(rawData);

  if (!result.success) {
    return json({ errors: result.error.formErrors.fieldErrors }, { status: 400 });
  }

  const { name, promptTemplate, exampleImageUrl } = result.data;

  await db.insert(aiStylesTable).values({
    uuid: crypto.randomUUID(),
    shopId: shopId,
    name,
    promptTemplate,
    exampleImageUrl: exampleImageUrl || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return json({ success: true });
};

export default function StylesIndexPage() {
  const { aiStyles } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<{ url: string; alt: string } | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(AiStyleSchema),
    defaultValues: {
      name: '',
      promptTemplate: '',
      exampleImageUrl: '',
    },
  });

  const onSubmit = (data: FormValues) => {
    submit(data, { method: 'post' });
  };

  useEffect(() => {
    if (actionData?.success) {
      reset();
      setIsModalOpen(false);
    }
  }, [actionData, reset]);

  const toggleModal = useCallback(() => {
    setIsModalOpen((active) => {
      if (!active) {
        // Reset form when opening modal
        reset();
      }
      return !active;
    });
  }, [reset]);

  // Image modal handlers
  const handleImageClick = (imageUrl: string, altText: string) => {
    setModalImage({ url: imageUrl, alt: altText });
  };

  const handleImageModalClose = () => {
    setModalImage(null);
  };

  const stylesMarkup = aiStyles.length ? (
    <IndexTable
      resourceName={{ singular: "AI Style", plural: "AI Styles" }}
      itemCount={aiStyles.length}
      headings={[
        { title: "Thumbnail" },
        { title: "Name" },
        { title: "Status" },
        { title: "Date Created" },
        { title: "Actions" },
      ]}
      selectable={false}
    >
      {aiStyles.map(
        (
          { id, uuid, name, promptTemplate, exampleImageUrl, createdAt, isActive },
          index
        ) => (
          <IndexTable.Row id={id.toString()} key={id} position={index}>
            <IndexTable.Cell>
              <HoverImagePreview
                imageUrl={exampleImageUrl || "https://via.placeholder.com/40"}
                altText={name || 'AI Style Example'}
                fallbackText="No image"
                onImageClick={handleImageClick}
              />
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text variant="bodyMd" fontWeight="bold" as="span">
                {name}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Badge tone={isActive ? "success" : undefined}>
                {isActive ? "Active" : "Draft"}
              </Badge>
            </IndexTable.Cell>
            <IndexTable.Cell>
              {new Date(createdAt).toLocaleDateString()}
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="200">
                <Link to={`/app/styles/${uuid}`}>
                  <Button size="slim">
                    Edit
                  </Button>
                </Link>
              </InlineStack>
            </IndexTable.Cell>
          </IndexTable.Row>
        )
      )}
    </IndexTable>
  ) : (
    <EmptyState
      heading="No AI Styles yet"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Create your first AI style to get started.</p>
      <Button onClick={toggleModal} variant="primary">
        Create AI Style
      </Button>
    </EmptyState>
  );

  return (
    <>
      <TitleBar title="AI Styles" />

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingLg">
                    AI Styles
                  </Text>
                  <InlineStack gap="200">
                    <Button onClick={toggleModal} variant="primary">
                      Create AI Style
                    </Button>
                  </InlineStack>
                </InlineStack>

                <Text variant="bodyMd" as="p">
                  Create and manage the AI art styles that customers can choose from for their generations.
                </Text>

                {/* Quick Stats */}
                <Layout>
                  <Layout.Section variant="oneThird">
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd" tone="subdued">Total Styles</Text>
                        <Text as="p" variant="headingXl">{aiStyles.length}</Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd" tone="subdued">Status</Text>
                        <Badge tone="success">Active</Badge>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>

            <Card>{stylesMarkup}</Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      <Modal
        open={isModalOpen}
        onClose={toggleModal}
        title="Create new AI Style"
        primaryAction={{
          content: 'Create',
          onAction: handleSubmit(onSubmit),
          loading: isSubmitting,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: toggleModal,
            disabled: isSubmitting,
          },
        ]}
      >
        <Modal.Section>
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
                  multiline={4}
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
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Image Modal */}
      <ImageModal
        imageUrl={modalImage?.url || null}
        altText={modalImage?.alt || null}
        isOpen={!!modalImage}
        onClose={handleImageModalClose}
      />
    </>
  );
} 