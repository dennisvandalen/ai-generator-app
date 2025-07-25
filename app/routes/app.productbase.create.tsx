import type {LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import {useLoaderData, useNavigate, useActionData, Form} from "@remix-run/react";
import {useState, useEffect, useCallback} from "react";
import {
  Page,
} from "@shopify/polaris";
import {TitleBar, useAppBridge} from "@shopify/app-bridge-react";
import {authenticate} from "~/shopify.server";
import drizzleDb from "~/db.server";
import {
  productBaseOptionsTable,
} from "~/db/schema";
import {getShopId} from "~/utils/getShopId";

// React Hook Form imports
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema and component imports
import { ProductBaseFormSchema, type ProductBaseFormData } from "~/schemas/productBase";
import { createActionRouter } from "~/utils/createActionRouter";
import { RHFFormSaveBar } from "~/components/RHFFormSaveBar";
import { ProductBaseForm } from "~/components/ProductBaseForm";

// Import server-side action handlers
import * as createProductBase from "~/actions/productBase/create";

// Wire up the action router
export const action = createActionRouter({
  "create-product-base": createProductBase.action,
});

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  // Fetch existing options to provide suggestions
  const existingOptions = await drizzleDb
    .select({name: productBaseOptionsTable.name})
    .from(productBaseOptionsTable)
    .groupBy(productBaseOptionsTable.name);

  const suggestionOptions = Array.from(new Set(existingOptions.map(opt => opt.name)));

  return Response.json({
    shopId,
    suggestionOptions,
  });
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function ProductBaseCreatePage() {
  const {suggestionOptions} = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // React Hook Form setup
  const form = useForm<ProductBaseFormData>({
    resolver: zodResolver(ProductBaseFormSchema),
    defaultValues: {
      name: "",
      description: "",
      optionNames: [],
      variants: [],
    },
    mode: 'onChange',
  });

  const {
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    watch,
    setValue,
    reset,
  } = form;

  // Watch form data for reactive updates
  const formData = watch();

  // Form submission handler - now uses Form action
  const onSubmit = handleSubmit((data) => {
    // Submit the form
    const form = document.getElementById('product-base-create-form') as HTMLFormElement;
    if (form) {
      // Clear existing data input
      const existingInput = form.querySelector('input[name="data"]');
      if (existingInput) {
        existingInput.remove();
      }
      
      // Add new data input
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'data';
      input.value = JSON.stringify({ ...data, _action: "create-product-base" });
      form.appendChild(input);
      
      form.submit();
    }
  });

  // Handle action response
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        shopify?.toast.show("Product Base created successfully", {duration: 3000});
        navigate('/app/productbase');
      } else if (actionData.error) {
        if (actionData.details) {
          actionData.details.forEach((detail: { field: string; message: string }) => {
            form.setError(detail.field as keyof ProductBaseFormData, { 
              message: detail.message 
            });
          });
        }
        console.error("Create failed:", actionData.error);
        shopify?.toast.show(actionData.error, { isError: true });
      }
    }
  }, [actionData, shopify, form, navigate]);

  // Create interface wrapper for ProductBaseForm component
  const formInterface = {
    data: formData,
    errors: Object.fromEntries(
      Object.entries(errors).map(([key, error]) => [key, error?.message || ""])
    ),
    setField: (field: keyof ProductBaseFormData, value: any) => 
      setValue(field, value, { shouldDirty: true }),
    submit: onSubmit,
    isSubmitting: isSubmitting,
  };

  const handleCancel = () => {
    navigate('/app/productbase');
  };

  return (
    <Page
      title="Create Product Base"
      subtitle="Create a new foundational product template for AI-generated designs"
      backAction={{
        content: 'Product Bases',
        onAction: handleCancel,
      }}
    >
      <TitleBar title="Create Product Base">
        <button variant="primary" onClick={handleCancel}>
          Cancel
        </button>
      </TitleBar>

      <Form id="product-base-create-form" method="post">
        <RHFFormSaveBar
          form={form}
          onSave={onSubmit}
          onDiscard={() => reset()}
        />

        <ProductBaseForm
          form={formInterface}
          suggestionOptions={suggestionOptions}
          isEditing={false}
          onCancel={handleCancel}
        />
      </Form>
    </Page>
  );
}