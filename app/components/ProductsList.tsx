import { useState } from "react";
import {
  Text,
  Button,
  BlockStack,
  Box,
  InlineStack,
  Pagination,
} from "@shopify/polaris";

interface Product {
  node: {
    id: string;
    title: string;
    handle: string;
    status: string;
    variants?: {
      edges?: Array<{
        node: {
          id: string;
          price: string;
        };
      }>;
    };
  };
}

interface ProductsListProps {
  products: Product[];
  shop: string;
}

export function ProductsList({ products, shop }: ProductsListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Pagination logic
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(Math.max(1, currentPage - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(Math.min(totalPages, currentPage + 1));
  };

  if (products.length === 0) {
    return (
      <Text variant="bodyMd" as="p">
        No products found. Create your first product using the button above.
      </Text>
    );
  }

  return (
    <BlockStack gap="300">
      <InlineStack align="space-between">
        <Text variant="bodyMd" as="p">
          You have {products.length} product{products.length !== 1 ? 's' : ''} in your store.
        </Text>
        <Text variant="bodySm" as="p" tone="subdued">
          Showing {startIndex + 1}-{Math.min(endIndex, products.length)} of {products.length}
        </Text>
      </InlineStack>
      <BlockStack gap="200">
        {currentProducts.map((productEdge) => {
          const product = productEdge.node;
          const productId = product.id.replace("gid://shopify/Product/", "");
          const price = product.variants?.edges?.[0]?.node?.price || "0.00";
          const onlineStoreUrl = `https://${shop}/products/${product.handle}`;
          const adminUrl = `shopify:admin/products/${productId}`;
          
          return (
            <Box
              key={product.id}
              padding="300"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <InlineStack align="space-between">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">
                    {product.title}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    Status: {product.status} • Price: ${price}
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Button
                    url={adminUrl}
                    target="_blank"
                    variant="secondary"
                    size="slim"
                  >
                    Admin
                  </Button>
                  <Button
                    url={onlineStoreUrl}
                    target="_blank"
                    variant="primary"
                    size="slim"
                  >
                    View Store
                  </Button>
                </InlineStack>
              </InlineStack>
            </Box>
          );
        })}
      </BlockStack>
      {totalPages > 1 && (
        <Box paddingBlockStart="400">
          <InlineStack align="center">
            <Pagination
              label={`Page ${currentPage} of ${totalPages}`}
              hasPrevious={currentPage > 1}
              onPrevious={handlePreviousPage}
              hasNext={currentPage < totalPages}
              onNext={handleNextPage}
            />
          </InlineStack>
        </Box>
      )}
    </BlockStack>
  );
} 