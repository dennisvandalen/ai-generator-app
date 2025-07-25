import {
  Text,
  BlockStack,
  Card,
  TextField,
  Button,
  InlineStack,
  Divider,
  Badge,
  Tooltip,
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon, InfoIcon } from "@shopify/polaris-icons";
import { useCallback } from "react";
import type { ProductBaseVariantData } from "~/schemas/productBase";
import { getDimensionInfo } from "~/utils/dpiConverter";

// UI version that allows string values for number inputs
interface ProductBaseVariantUIData {
  id?: number;
  name: string;
  widthPx: string | number;
  heightPx: string | number;
  price: string | number;
  compareAtPrice?: string | number;
  optionValues: Record<string, string>;
}

interface ProductBaseVariantFormProps {
  variants: ProductBaseVariantData[];
  optionNames: string[];
  onVariantsChange: (variants: ProductBaseVariantData[]) => void;
  errors?: Record<string, string>;
}

export function ProductBaseVariantForm({
  variants,
  optionNames,
  onVariantsChange,
  errors = {},
}: ProductBaseVariantFormProps) {
  // Convert ProductBaseVariantData to UI format (with string values)
  const uiVariants: ProductBaseVariantUIData[] = variants.map(variant => ({
    ...variant,
    widthPx: variant.widthPx.toString(),
    heightPx: variant.heightPx.toString(),
    price: variant.price.toString(),
    compareAtPrice: variant.compareAtPrice?.toString() || "",
  }));

  // Filter out validation errors for empty fields during editing
  const getFieldError = useCallback((variantIndex: number, field: string) => {
    const errorKey = `variants.${variantIndex}.${field}`;
    const error = errors[errorKey];

    // If there's an error but the field is empty, don't show it (allow empty editing)
    if (error && uiVariants[variantIndex]) {
      let fieldValue: any;

      // Handle nested field paths like 'optionValues.Size'
      if (field.includes('.')) {
        const [parentField, childField] = field.split('.');
        fieldValue = uiVariants[variantIndex][parentField as keyof ProductBaseVariantUIData]?.[childField];
      } else {
        fieldValue = uiVariants[variantIndex][field as keyof ProductBaseVariantUIData];
      }

      if (fieldValue === "" || fieldValue === undefined) {
        return undefined; // Don't show validation error for empty fields
      }
    }

    return error;
  }, [errors, uiVariants]);

  // Convert UI variants back to ProductBaseVariantData format
  const convertToVariantData = useCallback((uiVariants: ProductBaseVariantUIData[]): ProductBaseVariantData[] => {
    return uiVariants.map(uiVariant => {
      // Handle compareAtPrice properly - empty string or invalid number should be undefined, not 0
      let compareAtPrice: number | undefined = undefined;
      if (uiVariant.compareAtPrice && uiVariant.compareAtPrice !== "") {
        const parsed = Number(uiVariant.compareAtPrice);
        if (!isNaN(parsed) && parsed > 0) {
          compareAtPrice = parsed;
        }
      }

      return {
        ...uiVariant,
        widthPx: uiVariant.widthPx === "" ? 1 : Number(uiVariant.widthPx) || 1,
        heightPx: uiVariant.heightPx === "" ? 1 : Number(uiVariant.heightPx) || 1,
        price: uiVariant.price === "" ? 0 : Number(uiVariant.price) || 0,
        compareAtPrice,
      };
    });
  }, []);

  const addVariant = useCallback(() => {
    const newUIVariant: ProductBaseVariantUIData = {
      name: "",
      widthPx: "",
      heightPx: "",
      price: "",
      compareAtPrice: "",
      optionValues: optionNames.reduce((acc, optionName) => {
        acc[optionName] = "";
        return acc;
      }, {} as Record<string, string>),
    };
    const newUIVariants = [...uiVariants, newUIVariant];
    onVariantsChange(convertToVariantData(newUIVariants));
  }, [uiVariants, optionNames, onVariantsChange, convertToVariantData]);

  const removeVariant = useCallback(
    (index: number) => {
      const newUIVariants = uiVariants.filter((_, i) => i !== index);
      onVariantsChange(convertToVariantData(newUIVariants));
    },
    [uiVariants, onVariantsChange, convertToVariantData]
  );

  const updateVariant = useCallback(
    (index: number, field: keyof ProductBaseVariantUIData, value: any) => {
      const newUIVariants = [...uiVariants];
      newUIVariants[index] = { ...newUIVariants[index], [field]: value };
      onVariantsChange(convertToVariantData(newUIVariants));
    },
    [uiVariants, onVariantsChange, convertToVariantData]
  );

  const updateVariantOptionValue = useCallback(
    (variantIndex: number, optionName: string, value: string) => {
      const newUIVariants = [...uiVariants];
      newUIVariants[variantIndex] = {
        ...newUIVariants[variantIndex],
        optionValues: {
          ...newUIVariants[variantIndex].optionValues,
          [optionName]: value,
        },
      };
      onVariantsChange(convertToVariantData(newUIVariants));
    },
    [uiVariants, onVariantsChange, convertToVariantData]
  );

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="headingMd" as="h3">
            Variants
          </Text>
          <Button
            icon={PlusIcon}
            onClick={addVariant}
            size="slim"
          >
            Add Variant
          </Button>
        </InlineStack>

        {uiVariants.length === 0 ? (
          <Text variant="bodyMd" tone="subdued" as="p">
            No variants created yet. Add a variant to define different sizes, options, or pricing for this product base.
          </Text>
        ) : (
          <BlockStack gap="500">
            {uiVariants.map((variant, index) => (
              <Card key={index}>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingSm" as="h4">
                      Variant {index + 1}
                    </Text>
                    <Button
                      icon={DeleteIcon}
                      onClick={() => removeVariant(index)}
                      tone="critical"
                      size="slim"
                      accessibilityLabel={`Remove variant ${index + 1}`}
                    />
                  </InlineStack>

                  <TextField
                    label="Variant Name"
                    value={variant.name}
                    onChange={(value) => updateVariant(index, 'name', value)}
                    error={getFieldError(index, 'name')}
                    placeholder="e.g., Small, Medium, A4, 12oz"
                    autoComplete="off"
                    requiredIndicator
                  />

                  <BlockStack gap="300">
                    <InlineStack gap="300">
                      <TextField
                        label="Width (pixels)"
                        value={variant.widthPx.toString()}
                        onChange={(value) => updateVariant(index, 'widthPx', value)}
                        error={getFieldError(index, 'widthPx')}
                        type="number"
                        placeholder="2000"
                        autoComplete="off"
                        requiredIndicator
                      />
                      <TextField
                        label="Height (pixels)"
                        value={variant.heightPx.toString()}
                        onChange={(value) => updateVariant(index, 'heightPx', value)}
                        error={getFieldError(index, 'heightPx')}
                        type="number"
                        placeholder="2000"
                        autoComplete="off"
                        requiredIndicator
                      />
                    </InlineStack>

                    {/* DPI Converter Display */}
                    {variant.widthPx && variant.heightPx &&
                     Number(variant.widthPx) > 0 && Number(variant.heightPx) > 0 && (
                      <Card>
                        <BlockStack gap="200">
                          <InlineStack gap="200" align="center">
                            <Text variant="bodyMd" fontWeight="medium" as="p">
                              Physical Dimensions
                            </Text>
                            <Tooltip content="Approximate physical dimensions at different print resolutions">
                              <Button
                                icon={InfoIcon}
                                variant="plain"
                                size="micro"
                                accessibilityLabel="Dimension information"
                              />
                            </Tooltip>
                          </InlineStack>
                          <InlineStack gap="300" wrap>
                            {getDimensionInfo(Number(variant.widthPx), Number(variant.heightPx)).map(
                              ({ dpi, label, dimensions }) => (
                                <div key={dpi} style={{ minWidth: '140px' }}>
                                  <Text variant="bodySm" tone="subdued" as="p">
                                    {label}
                                  </Text>
                                  <Badge tone="info">{dimensions}</Badge>
                                </div>
                              )
                            )}
                          </InlineStack>
                        </BlockStack>
                      </Card>
                    )}
                  </BlockStack>

                  <InlineStack gap="300">
                    <TextField
                      label="Price"
                      value={variant.price.toString()}
                      onChange={(value) => updateVariant(index, 'price', value)}
                      error={getFieldError(index, 'price')}
                      type="number"
                      prefix="$"
                      placeholder="0.00"
                      autoComplete="off"
                      requiredIndicator
                    />
                    <TextField
                      label="Compare At Price (optional)"
                      value={variant.compareAtPrice?.toString() || ""}
                      onChange={(value) => updateVariant(index, 'compareAtPrice', value)}
                      error={getFieldError(index, 'compareAtPrice')}
                      type="number"
                      prefix="$"
                      placeholder="0.00"
                      autoComplete="off"
                    />
                  </InlineStack>

                  {optionNames.length > 0 && (
                    <>
                      <Divider />
                      <BlockStack gap="300">
                        <Text variant="bodyMd" fontWeight="semibold" as="p">
                          Option Values
                        </Text>
                        <InlineStack gap="300" wrap>
                          {optionNames.map((optionName) => (
                            <div key={optionName} style={{ minWidth: '200px' }}>
                              <TextField
                                label={optionName}
                                value={variant.optionValues[optionName] || ""}
                                onChange={(value) => updateVariantOptionValue(index, optionName, value)}
                                error={getFieldError(index, `optionValues.${optionName}`)}
                                placeholder={`Enter ${optionName.toLowerCase()}`}
                                autoComplete="off"
                              />
                            </div>
                          ))}
                        </InlineStack>
                      </BlockStack>
                    </>
                  )}
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        )}

        <Text variant="bodySm" tone="subdued" as="p">
          Variants define the different sizes, options, and pricing for this product base. Each variant should specify exact pixel dimensions for AI generation.
        </Text>
      </BlockStack>
    </Card>
  );
}
