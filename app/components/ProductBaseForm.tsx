import {
  Text,
  BlockStack,
  Card,
  TextField,
  Button,
  InlineStack,
  Tag,
} from "@shopify/polaris";
import { MultiselectCombobox } from "~/components/MultiSelectCombobox";
import { ProductBaseVariantForm } from "~/components/ProductBaseVariantForm";
import type { ProductBaseFormData } from "~/schemas/productBase";

interface ProductBaseFormProps {
  form: {
    data: ProductBaseFormData;
    errors: Record<string, string>;
    setField: (field: keyof ProductBaseFormData, value: any) => void;
    submit: () => void;
    isSubmitting: boolean;
  };
  suggestionOptions: string[];
  isEditing?: boolean;
  onCancel: () => void;
}

export function ProductBaseForm({
  form,
  suggestionOptions,
  isEditing = false,
  onCancel,
}: ProductBaseFormProps) {
  const submitLabel = isEditing ? "Update Product Base" : "Create Product Base";
  
  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Product Base Details
          </Text>

          <TextField
            label="Name"
            value={form.data.name || ""}
            onChange={(value) => form.setField("name", value)}
            error={form.errors.name}
            placeholder="e.g., Ceramic Mug, Classic T-Shirt, Canvas Print"
            autoComplete="off"
            requiredIndicator
          />

          <TextField
            label="Description (optional)"
            value={form.data.description || ""}
            onChange={(value) => form.setField("description", value)}
            error={form.errors.description}
            placeholder="Brief description of this product base"
            multiline={3}
            autoComplete="off"
          />

          <MultiselectCombobox
            selectedOptions={form.data.optionNames || []}
            onSelectionChange={(options) => form.setField("optionNames", options)}
            suggestionOptions={suggestionOptions}
            label="Options (optional)"
            placeholder="Search or add options like Size, Color, Material..."
            emptyStateText="options"
          />

          <Text variant="bodySm" tone="subdued" as="p">
            Options define the different variations this product base can have. For example, a T-Shirt might have Size and Color options.
          </Text>
        </BlockStack>
      </Card>

      <ProductBaseVariantForm
        variants={form.data.variants || []}
        optionNames={form.data.optionNames || []}
        onVariantsChange={(variants) => form.setField("variants", variants)}
        errors={form.errors}
      />

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Preview
          </Text>
          
          <InlineStack gap="400" wrap>
            <div>
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                Product Base Name:
              </Text>
              <Text variant="bodyMd" as="p">
                {form.data.name || "Enter a name above"}
              </Text>
            </div>
            
            {form.data.description && (
              <div>
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  Description:
                </Text>
                <Text variant="bodyMd" as="p">
                  {form.data.description}
                </Text>
              </div>
            )}
            
            {form.data.optionNames && form.data.optionNames.length > 0 && (
              <div>
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  Options:
                </Text>
                <InlineStack gap="200" wrap>
                  {form.data.optionNames.map((option) => (
                    <Tag key={option}>{option}</Tag>
                  ))}
                </InlineStack>
              </div>
            )}

            {form.data.variants && form.data.variants.length > 0 && (
              <div>
                <Text variant="bodyMd" fontWeight="semibold" as="p">
                  Variants:
                </Text>
                <Text variant="bodyMd" as="p">
                  {form.data.variants.length} variant{form.data.variants.length !== 1 ? 's' : ''} configured
                </Text>
              </div>
            )}
          </InlineStack>
        </BlockStack>
      </Card>

      <InlineStack gap="300" align="end">
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={form.submit}
          disabled={!form.data.name || form.isSubmitting}
          loading={form.isSubmitting}
        >
          {submitLabel}
        </Button>
      </InlineStack>
    </BlockStack>
  );
}