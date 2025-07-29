import {
  Layout,
  BlockStack,
  Card,
  Text,
  Checkbox,
  Banner,
  InlineStack,
  Button,
  Divider,
  Select,
  Badge,
  Modal,
} from "@shopify/polaris";
import { useCallback, useMemo, useState } from "react";
import type { ProductFormData, VariantCreationData } from "~/schemas/product";
import type { AiStyle, ProductBase, ProductBaseVariant, ProductBaseOption, ProductBaseVariantOptionValue } from "~/db/schema";

// Shopify product type (from Shopify API)
interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  shop?: string;
  featuredImage?: string;
  variants: Array<{
    id: string;
    title: string;
    price: string;
    position?: number;
    selectedOptions?: Array<{
      name: string;
      value: string;
    }>;
    compareAtPrice?: string;
  }>;
}

interface ProductDetailFormProps {
  form: {
    data: ProductFormData;
    errors: Record<string, string>;
    setField: (field: keyof ProductFormData, value: any) => void;
    submit: () => void;
    isSubmitting: boolean;
  };
  // Reference data
  aiStyles: AiStyle[];
  productBases: ProductBase[];
  productBaseVariants: ProductBaseVariant[];
  productBaseOptions: ProductBaseOption[];
  productBaseVariantOptionValues: ProductBaseVariantOptionValue[];
  shopifyProduct: ShopifyProduct;
  // Sync status
  syncStatus?: {
    variantsNeedingPriceSync: number;
  };
  // Handlers for complex operations (optional, not used in this simplified form)
  onVariantCreate?: (data: VariantCreationData) => void;
  onVariantDelete?: (variantId: string) => void;
  onVariantPriceUpdate?: (variantId: string, price: string) => void;
  onCreateAllMissingVariants?: (productBaseVariantIds: number[]) => void;
  onDeleteAllUnmappedVariants?: (variantIds: string[]) => void;
  onSyncVariants?: (options: { createMissing: boolean; updateExisting: boolean; removeOrphaned: boolean }) => void;
  onCleanupVariantMappings?: () => void;
  // UI state
  creatingVariants?: boolean;
  editingPrices?: Record<string, string>;
  onEditingPriceChange?: (variantId: string, price: string | null) => void;
}

export function ProductDetailForm({
  form,
  aiStyles,
  productBases,
  productBaseVariants,
  productBaseOptions,
  productBaseVariantOptionValues,
  shopifyProduct,
  syncStatus,
  onVariantCreate,
  onVariantDelete,
  onCreateAllMissingVariants,
  onDeleteAllUnmappedVariants,
  onSyncVariants,
  creatingVariants,
}: ProductDetailFormProps) {
  // State for toggles and selections
  const [selectedTab, setSelectedTab] = useState<'styles' | 'bases' | 'variants'>('styles');
  const [showConfirmDisable, setShowConfirmDisable] = useState(false);

  // Validate product base compatibility
  const productBaseValidation = useMemo(() => {
    if (!form.data.selectedProductBases || form.data.selectedProductBases.length <= 1) {
      return { isValid: true, warnings: [], errors: [] };
    }

    const selectedProductBases = productBases.filter(pb =>
      form.data.selectedProductBases!.includes(pb.uuid)
    );

    const errors = [];
    const warnings = [];

    // Step 1: Check option structure compatibility
    const optionStructures = new Map();

    for (const productBase of selectedProductBases) {
      // Get all options for this product base
      const optionsForBase = productBaseOptions.filter(opt => opt.productBaseId === productBase.id);
      const optionNames = optionsForBase.map(opt => opt.name).sort();
      const structureKey = optionNames.join(',');

      if (!optionStructures.has(structureKey)) {
        optionStructures.set(structureKey, {
          optionNames,
          productBases: []
        });
      }

      optionStructures.get(structureKey).productBases.push(productBase);
    }

    // Check if all selected product bases have compatible option structures
    if (optionStructures.size > 1) {
      const incompatibilityDetails = Array.from(optionStructures.values()).map(structure => ({
        options: structure.optionNames,
        productBases: structure.productBases.map((pb: ProductBase) => pb.name)
      }));

      errors.push({
        type: 'incompatible_options',
        message: 'Selected product bases have different option structures and cannot be used together.',
        details: incompatibilityDetails
      });
    }

    // Step 2: Check for incomplete variant option coverage
    if (errors.length === 0) { // Only check if structures are compatible
      const allOptionNames = Array.from(optionStructures.keys())[0]?.split(',') || [];
      const incompleteVariants = [];

      for (const productBase of selectedProductBases) {
        const variantsForBase = productBaseVariants.filter(v => v.productBaseId === productBase.id);

        for (const variant of variantsForBase) {
          // Get option values for this variant
          const variantOptionValues = productBaseVariantOptionValues.filter(ov => ov.productBaseVariantId === variant.id);
          const variantOptionNames = new Set();

          for (const optionValue of variantOptionValues) {
            const option = productBaseOptions.find(opt => opt.id === optionValue.productBaseOptionId);
            if (option) {
              variantOptionNames.add(option.name);
            }
          }

          const missingOptions = allOptionNames.filter((optionName: string) => !variantOptionNames.has(optionName));

          if (missingOptions.length > 0) {
            incompleteVariants.push({
              productBaseName: productBase.name,
              variantId: variant.id,
              missingOptions,
              existingOptions: Array.from(variantOptionNames)
            });
          }
        }
      }

      if (incompleteVariants.length > 0) {
        warnings.push({
          type: 'incomplete_variants',
          message: 'Some variants are missing option values. This will cause sync errors.',
          details: incompleteVariants
        });
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  }, [form.data.selectedProductBases, productBases, productBaseVariants, productBaseOptions, productBaseVariantOptionValues]);

  // Compute available product base variants for selected product bases
  const availableProductBaseVariants = useMemo(() => {
    // Filter variants to only those belonging to selected product bases
    const selectedProductBaseIds = new Set();
    form.data.selectedProductBases?.forEach(uuid => {
      const pb = productBases.find(p => p.uuid === uuid);
      if (pb?.id) selectedProductBaseIds.add(pb.id);
    });

    return productBaseVariants.filter(v =>
      selectedProductBaseIds.has(v.productBaseId)
    );
  }, [form.data.selectedProductBases, productBases, productBaseVariants]);

  // Compute missing variant mappings
  const missingVariantMappings = useMemo(() => {
    const mappedVariantIds = new Set(
      form.data.variantMappings?.map(m => m.productBaseVariantId) || []
    );

    return availableProductBaseVariants.filter(
      variant => !mappedVariantIds.has(variant.id)
    );
  }, [availableProductBaseVariants, form.data.variantMappings]);

  // Compute unmapped Shopify variants
  const unmappedShopifyVariants = useMemo(() => {
    const mappedShopifyVariantIds = new Set(
      form.data.variantMappings?.map(m => String(m.shopifyVariantId)) || []
    );

    // Detect default variant reliably (not based on localized text)
    // Default variant detection logic:
    // 1. If only one variant exists, it's the default
    // 2. Look for variant with single "Title" option (Shopify's default structure)
    // 3. Fallback: check for variant at position 1 (first variant)
    const defaultVariant = shopifyProduct.variants.length === 1 ? shopifyProduct.variants[0] :
      shopifyProduct.variants.find(v =>
        v.selectedOptions?.length === 1 &&
        v.selectedOptions[0]?.name === 'Title'
      ) || shopifyProduct.variants.find(v => v.position === 1);

    return shopifyProduct.variants.filter(
      variant => !mappedShopifyVariantIds.has(String(variant.id)) &&
                 variant.id !== defaultVariant?.id // Don't show default variant as unmapped
    );
  }, [shopifyProduct.variants, form.data.variantMappings]);

  // Handle AI Style selection
  const handleStyleToggle = useCallback((styleUuid: string, checked: boolean) => {
    const currentStyles = [...(form.data.selectedStyles || [])];

    if (checked) {
      if (!currentStyles.includes(styleUuid)) {
        currentStyles.push(styleUuid);
      }
    } else {
      const index = currentStyles.indexOf(styleUuid);
      if (index !== -1) {
        currentStyles.splice(index, 1);
      }
    }

    // Update both selectedStyles and reorderedStyles
    form.setField('selectedStyles', currentStyles);
    form.setField('reorderedStyles', currentStyles.map((uuid, index) => ({
      uuid,
      sortOrder: index,
    })));
  }, [form]);

  // Handle Product Base selection
  const handleProductBaseToggle = useCallback((productBaseUuid: string, checked: boolean) => {
    const currentProductBases = [...(form.data.selectedProductBases || [])];

    if (checked) {
      if (!currentProductBases.includes(productBaseUuid)) {
        currentProductBases.push(productBaseUuid);
      }
    } else {
      const index = currentProductBases.indexOf(productBaseUuid);
      if (index !== -1) {
        currentProductBases.splice(index, 1);
      }
    }

    form.setField('selectedProductBases', currentProductBases);

    // Clean up orphaned variant mappings
    const selectedProductBaseIds = productBases
      .filter(pb => currentProductBases.includes(pb.uuid))
      .map(pb => pb.id);

    const validVariantIds = productBaseVariants
      .filter(variant => selectedProductBaseIds.includes(variant.productBaseId))
      .map(variant => variant.id);

    const cleanedMappings = form.data.variantMappings.filter(
      mapping => validVariantIds.includes(mapping.productBaseVariantId)
    );

    form.setField('variantMappings', cleanedMappings);
  }, [form, productBases, productBaseVariants]);

  // Handle variant mapping changes
  const handleVariantMappingChange = useCallback((productBaseVariantId: number, shopifyVariantId: string | null) => {
    const currentMappings = [...(form.data.variantMappings || [])];

    // Remove existing mappings for both the product base variant and Shopify variant
    const filteredMappings = currentMappings.filter(
      mapping =>
        mapping.productBaseVariantId !== productBaseVariantId &&
        (shopifyVariantId ? String(mapping.shopifyVariantId) !== String(shopifyVariantId) : true)
    );

    // Add new mapping if shopifyVariantId is provided
    if (shopifyVariantId) {
      filteredMappings.push({
        productBaseVariantId,
        shopifyVariantId,
      });
    }

    form.setField('variantMappings', filteredMappings);
  }, [form]);

  // Style reordering (simplified - could add drag & drop later)
  const moveStyle = useCallback((styleUuid: string, direction: 'up' | 'down') => {
    const currentStyles = [...(form.data.selectedStyles || [])];
    const currentIndex = currentStyles.indexOf(styleUuid);

    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < currentStyles.length) {
      currentStyles.splice(currentIndex, 1);
      currentStyles.splice(newIndex, 0, styleUuid);

      // Mark fields as dirty to trigger save bar
      form.setField('selectedStyles', currentStyles);
      form.setField('reorderedStyles', currentStyles.map((uuid, index) => ({
        uuid,
        sortOrder: index,
      })));
    }
  }, [form]);

  return (
    <Layout>
      <Layout.Section>
        <BlockStack gap="500">

          {/* Product Info Card */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Product Information
              </Text>

              <InlineStack gap="300" align="space-between">
                <InlineStack gap="300" align="center">
                  {/* Product Image */}
                  {shopifyProduct.featuredImage && (
                    <div style={{ flexShrink: 0 }}>
                      <img
                        src={shopifyProduct.featuredImage}
                        alt={shopifyProduct.title}
                        style={{
                          width: '60px',
                          height: '60px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #e1e3e5'
                        }}
                      />
                    </div>
                  )}

                  {/* Product Title */}
                  <Text variant="bodyLg" fontWeight="semibold" as="p">
                    {shopifyProduct.title}
                  </Text>
                </InlineStack>

                {/* Action Buttons */}
                <InlineStack gap="200">
                  <Button
                    size="micro"
                    variant="tertiary"
                    url={`https://${shopifyProduct.shop}/products/${shopifyProduct.handle}`}
                    target="_blank"
                    external={true}
                  >
                    View in Shop
                  </Button>
                  <Button
                    size="micro"
                    variant="tertiary"
                    url={`https://admin.shopify.com/store/${shopifyProduct.shop?.replace('.myshopify.com', '')}/products/${shopifyProduct.id?.replace('gid://shopify/Product/', '')}`}
                    target="_blank"
                    external={true}
                  >
                    Edit in Shopify
                  </Button>
                </InlineStack>
              </InlineStack>

              <Divider />

              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  AI Generation Status
                </Text>
                <Checkbox
                  label="Enable AI generation for this product"
                  checked={form.data.isEnabled}
                  onChange={(checked) => form.setField('isEnabled', checked)}
                  error={form.errors.isEnabled}
                />
                <Text variant="bodySm" tone="subdued" as="p">
                  When enabled, customers will be able to upload images and generate AI-styled versions using the selected styles and product bases.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>

          {/* AI Styles Selection */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                AI Styles ({form.data.selectedStyles?.length || 0} selected)
              </Text>

              <BlockStack gap="300">
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  Available Styles:
                </Text>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '12px',
                  marginTop: '8px'
                }}>
                  {aiStyles.filter(style => style.isActive).map(style => {
                    const isSelected = form.data.selectedStyles?.includes(style.uuid) || false;
                    return (
                      <div
                        key={style.uuid}
                        onClick={() => handleStyleToggle(style.uuid, !isSelected)}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: isSelected ? '2px solid #3478f5' : '2px solid transparent',
                          transition: 'border-color 0.2s ease',
                        }}
                      >
                        {style.exampleImageUrl ? (
                          <img
                            src={style.exampleImageUrl}
                            alt={style.name}
                            style={{
                              width: '100%',
                              aspectRatio: '1 / 1',
                              objectFit: 'cover',
                              display: 'block'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            backgroundColor: '#f6f6f7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            color: '#6d7175'
                          }}>
                            No image
                          </div>
                        )}
                        <div style={{
                          position: 'absolute',
                          bottom: '0',
                          left: '0',
                          right: '0',
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                          color: 'white',
                          padding: '8px 6px 4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          textAlign: 'center',
                          lineHeight: '1.2'
                        }}>
                          {style.name}
                        </div>
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '20px',
                            height: '20px',
                            backgroundColor: '#3478f5',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: 'white'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </BlockStack>

              <Card background="bg-surface-secondary">
                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    Selected Styles (in order of priority):
                  </Text>
                  {(form.data.selectedStyles?.length || 0) === 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '80px',
                      color: '#6d7175',
                      fontSize: '14px',
                      fontStyle: 'italic'
                    }}>
                      No styles selected. Click styles above to add them.
                    </div>
                  ) : (
                    <div style={{ minHeight: '80px' }}>
                      <BlockStack gap="200">
                        {(form.data.selectedStyles || []).map((styleUuid, index) => {
                          const style = aiStyles.find(s => s.uuid === styleUuid);
                          if (!style) return null;

                          return (
                            <Card key={styleUuid}>
                              <InlineStack align="space-between">
                                <InlineStack gap="300" align="center">
                                  <Badge tone="info">{String(index + 1)}</Badge>
                                  {style.exampleImageUrl && (
                                    <img
                                      src={style.exampleImageUrl}
                                      alt={`${style.name} example`}
                                      style={{
                                        width: '40px',
                                        height: '40px',
                                        objectFit: 'cover',
                                        borderRadius: '4px',
                                        border: '1px solid #e1e3e5'
                                      }}
                                    />
                                  )}
                                  <Text variant="bodyMd" as="p">{style.name}</Text>
                                </InlineStack>
                                <InlineStack gap="200">
                                  <Button
                                    size="micro"
                                    variant="tertiary"
                                    onClick={() => moveStyle(styleUuid, 'up')}
                                    disabled={index === 0}
                                  >
                                    ↑
                                  </Button>
                                  <Button
                                    size="micro"
                                    variant="tertiary"
                                    onClick={() => moveStyle(styleUuid, 'down')}
                                    disabled={index === (form.data.selectedStyles?.length || 0) - 1}
                                  >
                                    ↓
                                  </Button>
                                  <Button
                                    size="micro"
                                    variant="tertiary"
                                    tone="critical"
                                    onClick={() => handleStyleToggle(styleUuid, false)}
                                  >
                                    Remove
                                  </Button>
                                </InlineStack>
                              </InlineStack>
                            </Card>
                          );
                        })}
                      </BlockStack>
                    </div>
                  )}
                </BlockStack>
              </Card>

              {form.errors.selectedStyles && (
                <Banner tone="critical">
                  <Text as="p">{form.errors.selectedStyles}</Text>
                </Banner>
              )}
            </BlockStack>
          </Card>

          {/* Product Bases Selection */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">
                  Product Bases ({form.data.selectedProductBases?.length || 0} selected)
                </Text>
                {form.data.selectedProductBases && form.data.selectedProductBases.length > 1 && (
                  <Badge
                    tone={productBaseValidation.isValid ? "success" : productBaseValidation.errors.length > 0 ? "critical" : "attention"}
                  >
                    {productBaseValidation.isValid ? "Compatible" : productBaseValidation.errors.length > 0 ? "Incompatible" : "Issues"}
                  </Badge>
                )}
              </InlineStack>

              <BlockStack gap="200">
                {productBases.map(productBase => (
                  <Card key={productBase.uuid}>
                    <InlineStack align="space-between">
                      <InlineStack gap="300" align="center">
                        <Checkbox
                          label=""
                          checked={form.data.selectedProductBases?.includes(productBase.uuid) || false}
                          onChange={(checked) => handleProductBaseToggle(productBase.uuid, checked)}
                        />
                        <Text variant="bodyMd" as="p">{productBase.name}</Text>
                      </InlineStack>
                    </InlineStack>
                  </Card>
                ))}
              </BlockStack>

              {/* Validation Errors */}
              {!productBaseValidation.isValid && (
                <BlockStack gap="200">
                  {productBaseValidation.errors.map((error, index) => (
                    <Banner key={`error-${index}`} tone="critical">
                      <BlockStack gap="200">
                        <Text as="p">{error.message}</Text>
                        {error.type === 'incompatible_options' && (
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="medium" as="p">Product bases by option structure:</Text>
                            {error.details.map((detail: any, detailIndex: number) => (
                              <Text key={detailIndex} variant="bodyMd" as="p">
                                • Options [{detail.options.join(', ')}]: {detail.productBases.join(', ')}
                              </Text>
                            ))}
                          </BlockStack>
                        )}
                      </BlockStack>
                    </Banner>
                  ))}
                </BlockStack>
              )}

              {/* Validation Warnings */}
              {productBaseValidation.warnings.length > 0 && (
                <BlockStack gap="200">
                  {productBaseValidation.warnings.map((warning, index) => (
                    <Banner key={`warning-${index}`} tone="warning">
                      <BlockStack gap="200">
                        <Text as="p">{warning.message}</Text>
                        {warning.type === 'incomplete_variants' && (
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="medium" as="p">Variants missing option values:</Text>
                            {warning.details.slice(0, 5).map((detail: any, detailIndex: number) => (
                              <Text key={detailIndex} variant="bodyMd" as="p">
                                • {detail.productBaseName} variant {detail.variantId}: Missing [{detail.missingOptions.join(', ')}]
                              </Text>
                            ))}
                            {warning.details.length > 5 && (
                              <Text variant="bodyMd" as="p">
                                ... and {warning.details.length - 5} more variants
                              </Text>
                            )}
                          </BlockStack>
                        )}
                      </BlockStack>
                    </Banner>
                  ))}
                </BlockStack>
              )}

              {/* Form validation errors */}
              {form.errors.selectedProductBases && (
                <Banner tone="critical">
                  <Text as="p">{form.errors.selectedProductBases}</Text>
                </Banner>
              )}
            </BlockStack>
          </Card>

          {/* Variant Mappings */}
          {availableProductBaseVariants.length > 0 && (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">
                    Variant Mappings ({form.data.variantMappings?.length || 0} of {availableProductBaseVariants.length} mapped)
                  </Text>
                </InlineStack>

                <Text variant="bodyMd" as="p">
                  Map product base variants to your Shopify product variants to define which AI-generated images will be created for each variant.
                </Text>

                {/* Sync Variants Section */}
                <Card background="bg-surface-success">
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3">
                      🚀 Sync Variants with Shopify
                    </Text>
                    <Text variant="bodyMd" as="p">
                      Automatically synchronize your product base variants with Shopify. This will create missing variants, update prices, and optionally remove orphaned variants.
                    </Text>

                    <InlineStack gap="300" wrap>
                      <SyncVariantsButton
                        onSyncVariants={onSyncVariants}
                        creatingVariants={creatingVariants}
                        missingCount={missingVariantMappings.length}
                        unmappedCount={unmappedShopifyVariants.length}
                        syncStatus={syncStatus}
                      />
                    </InlineStack>
                  </BlockStack>
                </Card>

                {/* Mapped Variants */}
                {form.data.variantMappings && form.data.variantMappings.length > 0 && (
                  <BlockStack gap="300">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      Mapped Variants:
                    </Text>
                    {form.data.variantMappings.map(mapping => {
                      const variant = availableProductBaseVariants.find(v => v.id === mapping.productBaseVariantId);
                      const productBase = productBases.find(pb => pb.id === variant?.productBaseId);
                      const shopifyVariant = shopifyProduct.variants.find(v => String(v.id) === String(mapping.shopifyVariantId));

                      if (!variant) return null;

                      return (
                        <Card key={variant.id}>
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="semibold" as="p">
                                {productBase?.name} - {variant.name}
                              </Text>
                              <BlockStack gap={'200'}>
                              <InlineStack gap="100" align="space-between">
                                <Text variant="bodyMd" as="span">
                                  {variant.widthPx} × {variant.heightPx} pixels
                                </Text>
                                <Text variant="bodySm" tone="subdued" as="span">
                                  Product Base Variant
                                </Text>
                              </InlineStack>

                              <InlineStack gap="200" align="space-between" wrap={false}>
                                <InlineStack gap="100" align="start">
                                  <Text variant="bodySm" tone="subdued" as="span">→</Text>
                                  <Text variant="bodySm" as="span">
                                    {shopifyVariant?.title || 'Unknown variant'}
                                  </Text>
                                </InlineStack>

                                <InlineStack gap="100" align="end">
                                  <Text variant="bodyMd" as="span" fontWeight="semibold">
                                    ${shopifyVariant?.price || 'N/A'}
                                  </Text>
                                  {shopifyVariant?.compareAtPrice && (
                                    <Text variant="bodySm" tone="subdued" as="span" textDecorationLine="line-through">
                                      ${shopifyVariant.compareAtPrice}
                                    </Text>
                                  )}
                                </InlineStack>
                              </InlineStack>
                            </BlockStack>
                            </BlockStack>

                            <Select
                              label=""
                              options={[
                                { label: 'Remove mapping', value: '' },
                                ...shopifyProduct.variants.map(v => ({
                                  label: `${v.title} - $${v.price}${v.compareAtPrice ? ` (was $${v.compareAtPrice})` : ''}`,
                                  value: v.id
                                }))
                              ]}
                              value={mapping.shopifyVariantId || ''}
                              onChange={(value) => handleVariantMappingChange(variant.id, value || null)}
                            />
                          </InlineStack>
                        </Card>
                      );
                    })}
                  </BlockStack>
                )}

                {/* Missing Mappings */}
                {missingVariantMappings.length > 0 && (
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        Missing Mappings ({missingVariantMappings.length} remaining):
                      </Text>
                      <Button
                        size="micro"
                        variant="secondary"
                        onClick={() => onCreateAllMissingVariants && onCreateAllMissingVariants(
                          missingVariantMappings.map(variant => variant.id)
                        )}
                        disabled={!onCreateAllMissingVariants || creatingVariants}
                        loading={creatingVariants}
                      >
                        Create All Missing Variants (Legacy)
                      </Button>
                    </InlineStack>
                    <Banner tone="warning">
                      <Text as="p">
                        {missingVariantMappings.length} product base variant{missingVariantMappings.length === 1 ? '' : 's'} {missingVariantMappings.length === 1 ? 'is' : 'are'} not mapped to Shopify variants.
                        Use "Sync Variants" above to automatically create these variants.
                      </Text>
                    </Banner>
                    {missingVariantMappings.map(variant => {
                      const productBase = productBases.find(pb => pb.id === variant.productBaseId);

                      return (
                        <Card key={variant.id}>
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="semibold" as="p">
                                {productBase?.name} - {variant.name}
                              </Text>
                              <Text variant="bodySm" tone="subdued" as="p">
                                {variant.widthPx} × {variant.heightPx} pixels
                              </Text>
                            </BlockStack>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ minWidth: '200px' }}>
                                <Select
                                  label=""
                                  options={[
                                    {
                                      label: shopifyProduct.variants.length === 0
                                        ? 'No Shopify variants available'
                                        : 'Select existing variant...',
                                      value: ''
                                    },
                                    ...shopifyProduct.variants.map(v => ({
                                      label: `${v.title} - $${v.price}`,
                                      value: v.id,
                                    })),
                                  ]}
                                  value=""
                                  onChange={(value) => handleVariantMappingChange(variant.id, value || null)}
                                  disabled={shopifyProduct.variants.length === 0}
                                />
                              </div>

                              <Text variant="bodySm" as="span" tone="subdued">or</Text>

                              <Button
                                size="micro"
                                variant="tertiary"
                                onClick={() => onVariantCreate && onVariantCreate({
                                  productBaseVariantId: variant.id
                                })}
                                disabled={!onVariantCreate || creatingVariants}
                                loading={creatingVariants}
                              >
                                Create Variant (Legacy)
                              </Button>
                            </div>
                          </InlineStack>
                        </Card>
                      );
                    })}
                  </BlockStack>
                )}

                {/* Available Shopify Variants */}
                {unmappedShopifyVariants.length > 0 && (
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" fontWeight="semibold" as="p">
                        Available Shopify Variants ({unmappedShopifyVariants.length} unmapped):
                      </Text>
                      <Button
                        size="micro"
                        variant="tertiary"
                        tone="critical"
                        onClick={() => onDeleteAllUnmappedVariants && onDeleteAllUnmappedVariants(
                          unmappedShopifyVariants.map(variant => variant.id)
                        )}
                        disabled={!onDeleteAllUnmappedVariants}
                      >
                        Delete All Unmapped Variants (Legacy)
                      </Button>
                    </InlineStack>
                    <Banner tone="info">
                      <Text as="p">
                        These Shopify variants are not mapped to any product base variants. Use "Sync Variants" above to automatically manage these.
                      </Text>
                    </Banner>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '8px'
                    }}>
                      {unmappedShopifyVariants.map(variant => (
                        <Card key={variant.id}>
                          <BlockStack gap="300">
                            <InlineStack gap="200" align="space-between">
                              <Text variant="bodyMd" as="p" fontWeight="medium">{variant.title}</Text>
                              <InlineStack gap="100" align="end">
                                <Text variant="bodyLg" as="span" fontWeight="semibold">
                                  ${variant.price}
                                </Text>
                                {variant.compareAtPrice && (
                                  <Text variant="bodySm" tone="subdued" as="span" textDecorationLine="line-through">
                                    ${variant.compareAtPrice}
                                  </Text>
                                )}
                              </InlineStack>
                            </InlineStack>

                            {variant.selectedOptions && variant.selectedOptions.length > 0 && (
                              <InlineStack gap="100" wrap>
                                {variant.selectedOptions.map((option, idx) => (
                                  <Badge key={idx} tone="info">
                                    {`${option.name}: ${option.value}`}
                                  </Badge>
                                ))}
                              </InlineStack>
                            )}

                            <Button
                              size="medium"
                              onClick={() => {
                                // Add mapping logic here
                              }}
                            >
                              Map to Product Base Variant
                            </Button>
                          </BlockStack>
                        </Card>
                      ))}
                    </div>
                  </BlockStack>
                )}

                {form.errors.variantMappings && (
                  <Banner tone="critical">
                    <Text as="p">{form.errors.variantMappings}</Text>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Summary Card */}
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Configuration Summary
              </Text>

              <InlineStack gap="400" wrap>
                <div>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">Status:</Text>
                  <Badge tone={form.data.isEnabled ? 'success' : 'attention'}>
                    {form.data.isEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">AI Styles:</Text>
                  <Text variant="bodyMd" as="p">
                    {form.data.selectedStyles?.length || 0} selected
                  </Text>
                </div>

                <div>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">Product Bases:</Text>
                  <Text variant="bodyMd" as="p">
                    {form.data.selectedProductBases?.length || 0} selected
                  </Text>
                </div>

                <div>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">Variant Mappings:</Text>
                  <Text variant="bodyMd" as="p">
                    {form.data.variantMappings?.length || 0} configured
                  </Text>
                </div>
              </InlineStack>
            </BlockStack>
          </Card>

        </BlockStack>
      </Layout.Section>
    </Layout>
  );
}

// Add the SyncVariantsButton component
interface SyncVariantsButtonProps {
  onSyncVariants?: (options: { createMissing: boolean; updateExisting: boolean; removeOrphaned: boolean }) => void;
  creatingVariants?: boolean;
  missingCount: number;
  unmappedCount: number;
  syncStatus?: {
    variantsNeedingPriceSync: number;
  };
}

function SyncVariantsButton({ onSyncVariants, creatingVariants, missingCount, unmappedCount, syncStatus }: SyncVariantsButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [syncOptions, setSyncOptions] = useState({
    createMissing: true,
    updateExisting: true,
    removeOrphaned: false,
  });

  const handleSync = useCallback(() => {
    if (onSyncVariants) {
      onSyncVariants(syncOptions);
      setShowModal(false);
    }
  }, [onSyncVariants, syncOptions]);

  const getButtonText = () => {
    if (creatingVariants) return "Syncing...";

    const totalIssues = missingCount + unmappedCount + (syncStatus?.variantsNeedingPriceSync || 0);
    if (totalIssues === 0) return "Sync Variants (Up to date)";

    const actions = [];
    if (missingCount > 0) actions.push(`${missingCount} to create`);
    if (syncStatus?.variantsNeedingPriceSync && syncStatus.variantsNeedingPriceSync > 0) {
      actions.push(`${syncStatus.variantsNeedingPriceSync} price updates`);
    }
    if (unmappedCount > 0) actions.push(`${unmappedCount} unmapped`);

    return `Sync Variants (${actions.join(', ')})`;
  };

  return (
    <>
      <Button
        variant="primary"
        size="large"
        onClick={() => setShowModal(true)}
        disabled={!onSyncVariants || creatingVariants}
        loading={creatingVariants}
        tone={missingCount > 0 || unmappedCount > 0 || (syncStatus?.variantsNeedingPriceSync && syncStatus.variantsNeedingPriceSync > 0) ? 'success' : undefined}
      >
        {getButtonText()}
      </Button>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Sync Variants with Shopify"
        primaryAction={{
          content: 'Sync Variants',
          onAction: handleSync,
          disabled: creatingVariants,
          loading: creatingVariants,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text variant="bodyMd" as="p">
              This will synchronize your product base variants with Shopify. Choose which operations to perform:
            </Text>

            <BlockStack gap="300">
              <Checkbox
                label={`Create missing variants in Shopify (${missingCount} variants)`}
                checked={syncOptions.createMissing}
                onChange={(checked) => setSyncOptions(prev => ({ ...prev, createMissing: checked }))}
                helpText="Creates Shopify variants for product base variants that don't have a corresponding Shopify variant"
              />

              <Checkbox
                label={`Update existing variant prices (${syncStatus?.variantsNeedingPriceSync || 0} variants need updates)`}
                checked={syncOptions.updateExisting}
                onChange={(checked) => setSyncOptions(prev => ({ ...prev, updateExisting: checked }))}
                helpText="Updates prices and compareAtPrice in Shopify to match your product base variant prices"
              />

              <Checkbox
                label={`Remove orphaned variants from Shopify (${unmappedCount} variants)`}
                checked={syncOptions.removeOrphaned}
                onChange={(checked) => setSyncOptions(prev => ({ ...prev, removeOrphaned: checked }))}
                helpText="⚠️ Deletes Shopify variants that aren't mapped to any product base variant. This action cannot be undone."
              />
            </BlockStack>

            {!syncOptions.createMissing && !syncOptions.updateExisting && !syncOptions.removeOrphaned && (
              <Banner tone="warning">
                <Text as="p">Please select at least one sync option.</Text>
              </Banner>
            )}

            {syncOptions.removeOrphaned && (
              <Banner tone="critical">
                <Text as="p">
                  <strong>Warning:</strong> Removing orphaned variants will permanently delete {unmappedCount} variant{unmappedCount === 1 ? '' : 's'} from Shopify.
                  This action cannot be undone. Make sure these variants are not needed.
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
