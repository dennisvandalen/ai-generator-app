import {Badge, BlockStack, Button, Card, Checkbox, InlineStack, Text,} from "@shopify/polaris";
import {useProductFormStore} from "~/stores/productFormStore";
export function ProductBasesSelection() {
  const {
    productBases,
    selectedProductBases,
    toggleProductBase,
    setSelectedProductBases,
    clearOrphanedMappings,
    isLoading
  } = useProductFormStore();

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Product Bases Selection
        </Text>

        {productBases.length > 0 ? (
          <BlockStack gap="400">
            <Text variant="bodyMd" as="p" tone="subdued">
              Select which product bases apply to this product. Product bases define the physical variants
              that customers can choose from.
            </Text>

            <div style={{
              border: '1px solid var(--p-border-subdued)',
              borderRadius: 'var(--p-border-radius-200)',
              overflow: 'hidden'
            }}>
              {productBases.map((productBase, index) => {
                const isSelected = selectedProductBases.includes(productBase.uuid);
                const isLast = index === productBases.length - 1;

                return (
                  <div
                    key={productBase.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: isSelected ? 'var(--p-surface-selected)' : 'var(--p-surface)',
                      borderBottom: isLast ? 'none' : '1px solid var(--p-border-subdued)',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onClick={isLoading ? undefined : () => {
                      const newIsSelected = !isSelected;
                      toggleProductBase(productBase.uuid, newIsSelected);

                      // If deselecting a product base, clean up orphaned mappings
                      if (!newIsSelected) {
                        // Get all product base variant IDs that are still valid
                        const productBaseVariants = useProductFormStore.getState().productBaseVariants || [];
                        const validProductBaseVariantIds = productBaseVariants.length > 0
                          ? productBaseVariants
                              .filter(v => {
                                // Check if the variant's product base is still selected
                                const productBaseUuid = v.productBase?.uuid;
                                return productBaseUuid &&
                                  selectedProductBases
                                    .filter(uuid => uuid !== productBase.uuid) // Exclude the one being deselected
                                    .includes(productBaseUuid);
                              })
                              .map(v => v.id)
                          : [];

                        // Clear orphaned mappings
                        clearOrphanedMappings(validProductBaseVariantIds);
                      }
                    }}
                  >
                    <div style={{marginRight: '12px', flexShrink: 0}}>
                      <Checkbox
                        label={`${isSelected ? 'Remove' : 'Add'} ${productBase.name}`}
                        labelHidden
                        checked={isSelected}
                        onChange={() => toggleProductBase(productBase.uuid, !isSelected)}
                        disabled={isLoading}
                      />
                    </div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <BlockStack gap="100">
                        <InlineStack gap="200" align="start">
                          <Text variant="bodyMd" fontWeight="semibold" as="span">
                            {productBase.name}
                          </Text>
                          <Badge
                            tone={productBase.isActive ? "success" : "critical"}
                            size="small"
                          >
                            {productBase.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {isSelected && (
                            <Badge tone="info" size="small">
                              Selected
                            </Badge>
                          )}
                        </InlineStack>
                        {productBase.description && (
                          <Text variant="bodySm" tone="subdued" as="span">
                            {productBase.description}
                          </Text>
                        )}
                      </BlockStack>
                    </div>
                  </div>
                );
              })}
            </div>

            <InlineStack gap="200" align="space-between">
              <Text variant="bodySm" tone="subdued" as="span">
                {selectedProductBases.length} of {productBases.length} product bases
                selected
              </Text>
              {selectedProductBases.length > 0 && (
                <Button
                  variant={'plain'}
                  size={'slim'}
                  onClick={() => setSelectedProductBases([])}
                  disabled={isLoading}
                >
                  Clear all
                </Button>
              )}
            </InlineStack>
          </BlockStack>
        ) : (
          <BlockStack gap="300">
            <Text variant="bodyMd" tone="subdued" as="p">
              No product bases have been created yet.
            </Text>
            <Button variant="primary" url="/app/productbase" disabled={isLoading}>
              Create Product Bases
            </Button>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
