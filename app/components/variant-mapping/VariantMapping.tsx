import {
  Text,
  Card,
  BlockStack,
  InlineStack,
  Button,
  IndexTable,
  Badge,
  Divider,
} from "@shopify/polaris";
import { useProductFormStore } from "~/stores/productFormStore";
import { ShopifyVariantRow } from "./ShopifyVariantRow";
import { UnmappedProductBaseVariantRow } from "./UnmappedProductBaseVariantRow";

interface VariantMappingProps {
  handleSubmit: (formData: FormData) => void;
}

export function VariantMapping({ handleSubmit }: VariantMappingProps) {
  const {
    shopifyProduct,
    selectedProductBases,
    variantMappings,
    setCreatingVariants,
    isLoading,
    creatingVariants,
    getAvailableProductBaseVariants
  } = useProductFormStore();

  // Get available variants (filtered by selected product bases)
  const availableProductBaseVariants = getAvailableProductBaseVariants();
  
  // Get unmapped product base variants (from available ones only)
  const unmappedVariants = availableProductBaseVariants.filter(v =>
    !variantMappings.some(m => m.productBaseVariantId === v.id)
  );

  // Calculate total item count
  const shopifyVariantsCount = shopifyProduct?.variants?.edges?.length || 0;
  const unmappedVariantsCount = selectedProductBases.length > 0 ? unmappedVariants.length : 0;
  const totalItemCount = shopifyVariantsCount + unmappedVariantsCount;

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header Section */}
        <InlineStack gap="300" align="space-between">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Product Variants
            </Text>
            <InlineStack gap="200">
              <Badge tone="info" size="small">
                {shopifyVariantsCount} Shopify variant{shopifyVariantsCount !== 1 ? 's' : ''}
              </Badge>
              {selectedProductBases.length > 0 && (
                <Badge tone="warning" size="small">
                  {unmappedVariantsCount} unmapped product base variant{unmappedVariantsCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </InlineStack>
          </BlockStack>

          {/* Actions Section */}
          {selectedProductBases.length > 0 && unmappedVariants.length > 0 && (
            <Button
              variant="secondary"
              size="medium"
              onClick={() => {
                setCreatingVariants(true);

                // Prepare variants to create (using already computed unmappedVariants)
                const variantsToCreate = unmappedVariants.map(variant => {
                  // Get option values for this variant
                  const options = useProductFormStore.getState().productBaseVariantOptionValues
                    .filter(v => v.productBaseVariantId === variant.id)
                    .map(v => {
                      const option = useProductFormStore.getState().productBaseOptions.find(o => o.id === v.productBaseOptionId);
                      return {
                        name: option?.name || '',
                        value: v.value
                      };
                    });

                  return {
                    productBaseVariantId: variant.id,
                    options
                  };
                });

                // Submit the form
                const formData = new FormData();
                formData.append("action", "create_variants");
                formData.append("variantsToCreate", JSON.stringify(variantsToCreate));
                handleSubmit(formData);
              }}
              disabled={isLoading || creatingVariants}
            >
              {creatingVariants ? 'Creating...' : `Create ${unmappedVariants.length} Missing Variant${unmappedVariants.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </InlineStack>

        {/* Info Section */}
        {selectedProductBases.length > 0 && (
          <>
            <Divider />
            <Text variant="bodySm" tone="subdued" as="p">
              Map Shopify variants to product base variants to enable AI generation. 
              Missing variants can be created automatically or you can create them manually in Shopify.
              Variant mappings are saved automatically when you save product changes.
            </Text>
          </>
        )}

        {/* Variant Table */}
        {totalItemCount > 0 ? (
          <IndexTable
            resourceName={{ singular: 'variant', plural: 'variants' }}
            itemCount={totalItemCount}
            headings={[
              { title: 'Variant Details' },
              { title: 'Price' },
              { title: 'Status' },
              ...(selectedProductBases.length > 0 ? [{ title: 'Product Base Mapping' }] : []),
              { title: 'Actions' }
            ]}
            selectable={false}
          >
            {/* Shopify Variants */}
            {shopifyProduct?.variants?.edges?.map((edge, index) => (
              <ShopifyVariantRow
                key={edge.node.id}
                variant={edge.node}
                index={index}
                handleSubmit={handleSubmit}
              />
            ))}

            {/* Unmapped Product Base Variants */}
            {selectedProductBases.length > 0 &&
              unmappedVariants.map((baseVariant, index) => (
                <UnmappedProductBaseVariantRow
                  key={`unmapped-${baseVariant.id}`}
                  baseVariant={baseVariant}
                  index={index}
                  shopifyVariantsCount={shopifyVariantsCount}
                  handleSubmit={handleSubmit}
                />
              ))
            }
          </IndexTable>
        ) : (
          <BlockStack gap="200">
            <Text variant="bodyMd" tone="subdued" as="p">
              {selectedProductBases.length > 0 
                ? "No variants available for the selected product bases."
                : "No variants found for this product."
              }
            </Text>
            {selectedProductBases.length === 0 && (
              <Text variant="bodySm" tone="subdued" as="p">
                Select product bases above to see variant mapping options.
              </Text>
            )}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
