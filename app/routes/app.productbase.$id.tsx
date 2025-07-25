import type {LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import {useLoaderData, useNavigate, useActionData, Form} from "@remix-run/react";
import {useState, useEffect} from "react";
import {
  Page,
} from "@shopify/polaris";
import {TitleBar, useAppBridge} from "@shopify/app-bridge-react";
import {authenticate} from "../shopify.server";
import drizzleDb from "../db.server";
import {
  productBaseOptionsTable,
  productBasesTable,
  productBaseVariantsTable,
  productBaseVariantOptionValuesTable,
} from "../db/schema";
import {getShopId} from "../utils/getShopId";
import { eq, and, inArray } from "drizzle-orm";

// React Hook Form imports
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema and component imports
import { ProductBaseFormSchema, type ProductBaseFormData } from "~/schemas/productBase";
import { createActionRouter } from "~/utils/createActionRouter";
import { RHFFormSaveBar } from "~/components/RHFFormSaveBar";
import { ProductBaseForm } from "~/components/ProductBaseForm";

// Import server-side action handlers
import * as updateProductBase from "~/actions/productBase/update";

// Wire up the action router
export const action = createActionRouter({
  "update-product-base": updateProductBase.action,
});

export const loader = async ({request, params}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  if (!params.id) {
    throw new Response("Product Base UUID is required", { status: 400 });
  }

  // Fetch the product base
  const productBase = await drizzleDb
    .select()
    .from(productBasesTable)
    .where(
      and(
        eq(productBasesTable.uuid, params.id),
        eq(productBasesTable.shopId, shopId)
      )
    )
    .limit(1);

  if (!productBase.length) {
    throw new Response("Product Base not found", { status: 404 });
  }

  // Fetch the product base options
  const options = await drizzleDb
    .select()
    .from(productBaseOptionsTable)
    .where(eq(productBaseOptionsTable.productBaseId, productBase[0].id))
    .orderBy(productBaseOptionsTable.sortOrder);

  // Fetch the product base variants
  const variants = await drizzleDb
    .select()
    .from(productBaseVariantsTable)
    .where(eq(productBaseVariantsTable.productBaseId, productBase[0].id))
    .orderBy(productBaseVariantsTable.sortOrder);

  // Fetch variant option values for all variants of this product base
  const variantIds = variants.map(v => v.id);
  const variantOptionValues = variantIds.length > 0 ? await drizzleDb
    .select({
      variantId: productBaseVariantOptionValuesTable.productBaseVariantId,
      optionId: productBaseVariantOptionValuesTable.productBaseOptionId,
      value: productBaseVariantOptionValuesTable.value,
      optionName: productBaseOptionsTable.name,
    })
    .from(productBaseVariantOptionValuesTable)
    .innerJoin(
      productBaseOptionsTable,
      eq(productBaseVariantOptionValuesTable.productBaseOptionId, productBaseOptionsTable.id)
    )
    .where(
      inArray(productBaseVariantOptionValuesTable.productBaseVariantId, variantIds)
    ) : [];

  // Transform variants to include option values
  const variantsWithOptions = variants.map(variant => {
    const optionValues: Record<string, string> = {};
    variantOptionValues
      .filter(vo => vo.variantId === variant.id)
      .forEach(vo => {
        optionValues[vo.optionName] = vo.value;
      });

    return {
      id: variant.id,
      name: variant.name,
      widthPx: variant.widthPx,
      heightPx: variant.heightPx,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      optionValues,
    };
  });

  // Fetch existing options to provide suggestions
  const existingOptions = await drizzleDb
    .select({name: productBaseOptionsTable.name})
    .from(productBaseOptionsTable)
    .groupBy(productBaseOptionsTable.name);

  const suggestionOptions = Array.from(new Set(existingOptions.map(opt => opt.name)));

  return Response.json({
    productBase: productBase[0],
    options: options,
    variants: variantsWithOptions,
    suggestionOptions,
  });
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function ProductBaseEditPage() {
  const {productBase, options, variants, suggestionOptions} = useLoaderData<typeof loader>();
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

  // Initialize form with existing data
  useEffect(() => {
    if (productBase) {
      form.reset({
        id: productBase.uuid,
        name: productBase.name || "",
        description: productBase.description || "",
        optionNames: options.map(option => option.name),
        variants: variants || [],
      });
    }
  }, [productBase, options, variants, form]);

  // Form submission handler - now uses Form action
  const onSubmit = handleSubmit((data) => {
    // Create form data for submission
    const formData = new FormData();
    formData.append('data', JSON.stringify({ ...data, _action: "update-product-base" }));

    // Submit the form
    const form = document.getElementById('product-base-form') as HTMLFormElement;
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
      input.value = JSON.stringify({ ...data, _action: "update-product-base" });
      form.appendChild(input);

      form.submit();
    }
  });

  // Handle action response
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        shopify?.toast.show("Product Base updated successfully", {duration: 3000});
        // After successful save, the page will reload and form will be clean
      } else if (actionData.error) {
        if (actionData.details) {
          actionData.details.forEach((detail: { field: string; message: string }) => {
            form.setError(detail.field as keyof ProductBaseFormData, {
              message: detail.message
            });
          });
        }
        console.error("Update failed:", actionData.error);
        shopify?.toast.show(actionData.error, { isError: true });
      }
    }
  }, [actionData, shopify, form]);

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
      title={`Edit ${productBase.name}`}
      subtitle="Update the product base details and options"
      backAction={{
        content: 'Product Bases',
        onAction: handleCancel,
      }}
    >
      <TitleBar title={`Edit ${productBase.name}`}>
        <button variant="primary" onClick={handleCancel}>
          Cancel
        </button>
      </TitleBar>

      <Form id="product-base-form" method="post">
        <RHFFormSaveBar
          form={form}
          onSave={onSubmit}
          onDiscard={() => reset()}
        />

        <ProductBaseForm
          form={formInterface}
          suggestionOptions={suggestionOptions}
          isEditing={true}
          onCancel={handleCancel}
        />
      </Form>
    </Page>
  );
}
