import {
  Text,
} from "@shopify/polaris";
import { extractShopifyId } from "~/utils/shopHelpers";
import { useProductFormStore } from "~/stores/productFormStore";

interface VariantMappingSelectorProps {
  variant: any;
  mapping: any;
  mappedProductBaseVariant: any;
  isLoading: boolean;
}

export function VariantMappingSelector({
  variant,
  mapping,
  mappedProductBaseVariant,
  isLoading
}: VariantMappingSelectorProps) {
  const {
    updateVariantMapping,
    getAvailableProductBaseVariants
  } = useProductFormStore();

  // Use filtered variants based on selected product bases
  const availableProductBaseVariants = getAvailableProductBaseVariants();

  return (
    <>
      <select
        value={mapping?.productBaseVariantId || ''}
        onChange={(e) => {
          const productBaseVariantId = e.target.value ? parseInt(e.target.value) : null;
          if (productBaseVariantId) {
            // Adding or changing a mapping
            // Pass the productBaseVariantId and shopifyVariantId to create/update the mapping
            // Extract the numeric ID from the Shopify variant's GID
            updateVariantMapping(productBaseVariantId, extractShopifyId(variant.id));
          } else {
            // Removing a mapping - if mapping exists, remove it
            // Fixed: When selecting "No Mapping", properly remove the existing mapping
            // by passing the existing productBaseVariantId and null for shopifyVariantId
            if (mapping) {
              updateVariantMapping(mapping.productBaseVariantId, null);
            }
          }
        }}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          minWidth: '200px'
        }}
      >
        <option value="">— No Mapping —</option>
        {availableProductBaseVariants.map(baseVariant => (
          <option key={baseVariant.id} value={baseVariant.id}>
            {baseVariant.productBase?.name} - {baseVariant.name}
          </option>
        ))}
      </select>
      {mappedProductBaseVariant && (
        <Text variant="bodySm" tone="subdued" as="p">
          {mappedProductBaseVariant.widthPx} × {mappedProductBaseVariant.heightPx}px
        </Text>
      )}
    </>
  );
}
