import {
  Text,
  BlockStack,
  Badge,
  Button,
  IndexTable,
} from "@shopify/polaris";
import { extractShopifyId } from "~/utils/shopHelpers";
import { useProductFormStore } from "~/stores/productFormStore";
import { VariantPriceEditor } from "./VariantPriceEditor";
import { VariantMappingSelector } from "./VariantMappingSelector";

interface ShopifyVariantRowProps {
  variant: any;
  index: number;
  handleSubmit: (formData: FormData) => void;
}

export function ShopifyVariantRow({ variant, index, handleSubmit }: ShopifyVariantRowProps) {
  const {
    productBaseVariants,
    variantMappings,
    setEditingVariantPrice,
    editingVariantPrices,
    deleteVariant,
    isLoading
  } = useProductFormStore();

  const mapping = variantMappings.find(m => String(m.shopifyVariantId) === extractShopifyId(variant.id));
  const mappedProductBaseVariant = mapping
    ? productBaseVariants.find(v => v.id === mapping.productBaseVariantId)
    : null;

  return (
    <IndexTable.Row
      id={variant.id}
      key={variant.id}
      position={index}
    >
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {variant.title}
          </Text>
          {variant.selectedOptions?.length > 0 && (
            <Text variant="bodySm" tone="subdued" as="p">
              Options: {variant.selectedOptions.map((option: { name: string; value: string; }) => `${option.name}: ${option.value}`).join(', ')}
            </Text>
          )}
          <Badge tone="info" size="small">Shopify Variant</Badge>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <VariantPriceEditor
          variant={variant}
          editingPrice={editingVariantPrices[variant.id]}
          setEditingVariantPrice={setEditingVariantPrice}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={variant.availableForSale ? "success" : "critical"}>
          {variant.availableForSale ? "Available" : "Unavailable"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <VariantMappingSelector
          variant={variant}
          mapping={mapping}
          mappedProductBaseVariant={mappedProductBaseVariant}
          isLoading={isLoading}
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        {!mapping && (
          <Button
            variant={'plain'}
            tone={'critical'}
            size={'slim'}
            onClick={() => deleteVariant(variant.id)}
            disabled={isLoading}
          >
            Delete Shopify Variant
          </Button>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  );
}
