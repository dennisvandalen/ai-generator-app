import {
  Page,
  Layout,
  BlockStack,
  Banner,
  Text,
} from "@shopify/polaris";
import { TitleBar, SaveBar } from "@shopify/app-bridge-react";
import { useEffect } from "react";
import BreadcrumbLink from "./BreadcrumbLink";
import { AiStyleSelection } from "./AiStyleSelection";
import { ProductDetails } from "./ProductDetails";
import { ProductBasesSelection } from "./ProductBasesSelection";
import { VariantMapping } from "./variant-mapping/VariantMapping";
import { useProductFormStore } from "~/stores/productFormStore";

import type { NavigateFunction } from "@remix-run/react";

// Define ActionData type inline to match the structure in the parent component
type ActionData =
  | { error: string; success?: undefined; message?: undefined }
  | { success: true; message: string; error?: undefined };

// Define a custom interface for the shopify object based on how it's used in the component
interface ShopifyAppBridge {
  saveBar: {
    show: (id: string) => void;
    hide: (id: string) => void;
  };
  toast: {
    show: (message: string, options?: { duration?: number; isError?: boolean }) => void;
  };
}

interface ProductDetailPageProps {
  shopify: ShopifyAppBridge | null;
  navigate: NavigateFunction;
  actionData: ActionData | undefined;
  revalidator: {
    state: "idle" | "loading";
    revalidate: () => void;
  };
  handleSubmit: (formData: FormData) => void;
}

export function ProductDetailPage({
  shopify,
  navigate,
  actionData,
  revalidator,
  handleSubmit
}: ProductDetailPageProps) {
  const {
    product,
    isDirty,
    isLoading,
    isSaving,
    resetForm,
    submitForm,
    setActionResult,
    shop,
    updateNeeded
  } = useProductFormStore();

  // Show/hide save bar based on changes
  useEffect(() => {
    if (shopify) {

      console.log('isDirty:', isDirty, 'isLoading:', isLoading);

      if (isDirty || isLoading) {
        shopify.saveBar.show('product-edit-save-bar');
      } else {
        shopify.saveBar.hide('product-edit-save-bar');
      }
    }
  }, [isDirty, isLoading, shopify]);

  /**
   * Handle action results from form submission
   *
   * This useEffect implements the reactive approach to form state management:
   * 1. When actionData changes (form submission completes), we reset the form states
   * 2. This eliminates the need for arbitrary timeouts in the submitForm function
   * 3. The approach ensures states are reset based on actual server response
   */
  useEffect(() => {
    if (actionData && shopify) {
      // Reset form states regardless of success or error
      // This is the key part of the reactive approach that replaces the timeout in submitForm
      const store = useProductFormStore.getState();
      store.setLoading(false);
      store.setSaving(false);
      store.setPreventStateReset(false);

      if ('success' in actionData && actionData.success) {
        // Show success toast
        shopify.toast.show(actionData.message, {duration: 3000});

        // Revalidate to refresh the data
        revalidator.revalidate();
      } else if ('error' in actionData && actionData.error) {
        // Show error toast
        shopify.toast.show(actionData.error, {duration: 8000, isError: true});

        // Set action result in store
        setActionResult({ error: actionData.error });

        // Scroll to top to ensure error banner is visible
        if (typeof window !== 'undefined') {
          window.scrollTo({top: 0, behavior: 'smooth'});
        }
      }
    }
  }, [actionData, shopify, revalidator, setActionResult]);

  // Get error and success messages from store
  const hasError = !!useProductFormStore.getState().actionData?.error;
  const errorMessage = useProductFormStore.getState().actionData?.error;
  const successMessage = useProductFormStore.getState().actionData?.message;

  return (
    <Page title={`${product.title}`}
          backAction={{
            content: 'Products',
            onAction: () => navigate('/app/products'),
          }}
    >
      <TitleBar title={`${product.title}`}>
        <BreadcrumbLink to="/app/products">
          Products
        </BreadcrumbLink>
      </TitleBar>

      <BlockStack gap="500">
        {/* Error Banner */}
        {hasError && (
          <Banner tone="critical" onDismiss={() => window.location.reload()}>
            <BlockStack gap="200">
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                Action Failed
              </Text>
              <Text variant="bodyMd" as="p">
                {errorMessage}
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                This error has also been shown as a notification. Click the × to dismiss and try again.
              </Text>
            </BlockStack>
          </Banner>
        )}

        {/* Success Banner */}
        {successMessage && (
          <Banner tone="success">
            <Text variant="bodyMd" as="p">
              {successMessage}
            </Text>
          </Banner>
        )}

        {updateNeeded && (
          <Banner tone="info">
            Product title was automatically updated from Shopify to keep data in sync.
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              {/* Product Details Card */}
              <ProductDetails shop={shop} />

              {/* AI Style Selection Card */}
              <AiStyleSelection
                aiStyles={useProductFormStore.getState().aiStyles}
                onToggleStyle={useProductFormStore.getState().toggleStyle}
                selectedStyles={useProductFormStore.getState().selectedStyles}
                onSelectedStylesChange={useProductFormStore.getState().setSelectedStyles}
                isLoading={isLoading}
              />

              {/* Product Bases Selection Card */}
              <ProductBasesSelection />

              {/* Variant Mapping Card */}
              <VariantMapping handleSubmit={handleSubmit} />
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Native Shopify SaveBar */}
      <SaveBar id="product-edit-save-bar">
        <button
          variant="primary"
          onClick={() => submitForm(handleSubmit)}
          loading={isLoading ? "" : undefined}
          disabled={isLoading}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={resetForm}
          disabled={isLoading}
        >
          Discard
        </button>
      </SaveBar>
    </Page>
  );
}
