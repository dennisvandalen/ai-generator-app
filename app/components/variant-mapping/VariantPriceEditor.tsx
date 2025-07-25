import {
  Text,
  InlineStack,
  Button,
} from "@shopify/polaris";
import { useProductFormStore } from "~/stores/productFormStore";

interface VariantPriceEditorProps {
  variant: any;
  editingPrice: string | undefined;
  setEditingVariantPrice: (variantId: string, price: string | null) => void;
  handleSubmit: (formData: FormData) => void;
  isLoading: boolean;
}

export function VariantPriceEditor({
  variant,
  editingPrice,
  setEditingVariantPrice,
  handleSubmit,
  isLoading
}: VariantPriceEditorProps) {
  const { updateVariantPrice } = useProductFormStore();

  if (editingPrice) {
    return (
      <InlineStack gap="200" align="start">
        <input
          type="number"
          value={editingPrice}
          onChange={(e) => setEditingVariantPrice(variant.id, e.target.value)}
          style={{
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            width: '100px'
          }}
        />
        <Button
          variant={'primary'}
          size={'slim'}
          onClick={() => {
            updateVariantPrice(variant.id, editingPrice);
          }}
          disabled={isLoading}
        >
          Save
        </Button>
        <Button
          size={'slim'}
          onClick={() => setEditingVariantPrice(variant.id, null)}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </InlineStack>
    );
  }

  return (
    <InlineStack gap="200" align="start">
      <Text variant="bodyMd" as="span">
        ${variant.price}
      </Text>
      <Button
        size={'slim'}
        onClick={() => setEditingVariantPrice(variant.id, variant.price)}
        disabled={isLoading}
      >
        Edit
      </Button>
    </InlineStack>
  );
}
