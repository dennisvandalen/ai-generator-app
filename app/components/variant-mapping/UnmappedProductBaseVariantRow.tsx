import {
  Text,
  BlockStack,
  Badge,
  Button,
  IndexTable,
} from "@shopify/polaris";
import { useProductFormStore } from "~/stores/productFormStore";

interface UnmappedProductBaseVariantRowProps {
  baseVariant: any;
  index: number;
  shopifyVariantsCount: number;
  handleSubmit: (formData: FormData) => void;
}

export function UnmappedProductBaseVariantRow({
                                                baseVariant,
                                                index,
                                                shopifyVariantsCount,
                                                handleSubmit
                                              }: UnmappedProductBaseVariantRowProps) {
  const {
    createVariant,
    productBaseVariantOptionValues,
    productBaseOptions,
    isLoading,
    creatingVariants,
    setCreatingVariants
  } = useProductFormStore();

  return (
    <IndexTable.Row
      id={`unmapped-${baseVariant.id}`}
      key={`unmapped-${baseVariant.id}`}
      position={shopifyVariantsCount + index}
    >
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {baseVariant.productBase?.name} - {baseVariant.name}
          </Text>
          <Text variant="bodySm" tone="subdued" as="p">
            Dimensions: {baseVariant.widthPx} × {baseVariant.heightPx}px
          </Text>
          <Badge tone="warning" size="small">Product Base Variant</Badge>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued" as="span">
          No Shopify variant
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="critical">
          Needs Shopify Variant
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          variant={'primary'}
          size={'slim'}
          onClick={() => {
            setCreatingVariants(true);

            // Get option values for this variant
            const options = productBaseVariantOptionValues
              .filter(v => v.productBaseVariantId === baseVariant.id)
              .map(v => {
                const option = productBaseOptions.find(o => o.id === v.productBaseOptionId);
                return {
                  name: option?.name || '',
                  value: v.value
                };
              });

            // Create the variant
            createVariant(baseVariant.id, options);
          }}
          disabled={isLoading || creatingVariants}
        >
          {creatingVariants ? 'Creating...' : 'Create Shopify Variant'}
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  );
}
