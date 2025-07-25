import {
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
  Checkbox,
  Button, Image,
} from "@shopify/polaris";
import { useProductFormStore } from "~/stores/productFormStore";

interface ProductDetailsProps {
  shop: string;
}

export function ProductDetails({ shop }: ProductDetailsProps) {
  const {
    product,
    shopifyProduct,
    isEnabled,
    toggleEnabled,
    isLoading
  } = useProductFormStore();

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="400" align="start">
          <Image
            source={shopifyProduct?.images?.edges?.[0]?.node?.url ?? ''}
            alt={product.title}
            style={{width: '200px', height: '200px', objectFit: 'contain'}}
          />
          <BlockStack gap="300">
            <Text as="h1" variant="headingLg">
              {product.title}
            </Text>

            <InlineStack gap="300">
              <Badge tone={isEnabled ? "success" : "attention"}>
                {isEnabled ? "AI Enabled" : "AI Disabled"}
              </Badge>
            </InlineStack>

            <Checkbox
              label="Enable for AI Generation"
              checked={isEnabled}
              onChange={toggleEnabled}
              helpText="When enabled, customers can generate AI art for this product."
              disabled={isLoading}
            />

            <InlineStack gap="300">
              {shopifyProduct && (
                <InlineStack gap="300">
                  <Button
                    url={`https://${shop}/products/${shopifyProduct.handle}`}
                    target="_blank"
                    external
                    variant="plain"
                    size="slim"
                  >
                    View in Shop
                  </Button>
                  <Button
                    url={`https://${shop}/admin/products/${product.shopifyProductId}`}
                    target="_blank"
                    external
                    variant="plain"
                    size="slim"
                  >
                    Edit in Shopify
                  </Button>
                </InlineStack>
              )}
            </InlineStack>
          </BlockStack>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
