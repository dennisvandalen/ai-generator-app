import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Page, Text, BlockStack, Card, List, Divider, DataTable } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

const demoRows = [
  [
    'Ceramic Mug',
    'White',
    '2000 x 900 px',
    'mug-mockup.png',
  ],
  [
    'Ceramic Mug',
    'Black',
    '2000 x 900 px',
    'mug-mockup.png',
  ],
  [
    'Ceramic Mug',
    'Red',
    '2000 x 900 px',
    'mug-mockup.png',
  ],
  [
    'Classic T-Shirt',
    'S',
    '3000 x 4000 px*',
    'tshirt-mockup.png',
  ],
  [
    'Classic T-Shirt',
    'M',
    '3000 x 4000 px*',
    'tshirt-mockup.png',
  ],
  [
    'Classic T-Shirt',
    'L',
    '3000 x 4000 px*',
    'tshirt-mockup.png',
  ],
  [
    'Classic T-Shirt',
    'XL',
    '3000 x 4000 px*',
    'tshirt-mockup.png',
  ],
  [
    'Canvas Print',
    '12x16',
    '4000 x 3000 px',
    'canvas-mockup.png',
  ],
  [
    'Canvas Print',
    '16x20',
    '5000 x 4000 px',
    'canvas-mockup.png',
  ],
];

export default function ProductbasePage() {
  return (
    <Page title="Productbase">
      <BlockStack gap="600">
        <Text variant="bodyLg" as="p" tone="subdued">
          Effortlessly manage and configure the foundational products for your store's custom designs and print-on-demand workflows.
        </Text>
        <Card>
          <BlockStack gap="500">
            <Text variant="headingLg" as="h2">
              What are Product Bases?
            </Text>
            <Text as="p">
              <b>Product Bases</b> are custom products (like mugs, t-shirts, etc.) that you configure for your store. Each Product Base includes all the information needed to sell and fulfill the product, such as print file requirements, available variants (like colors and sizes), and mockup images.
            </Text>
            <Divider />
            <Text variant="headingLg" as="h2">
              Why use Product Bases?
            </Text>
            <List>
              <List.Item>
                <b>Fast setup:</b> Instantly apply any design to a Product Base—no need to manually configure variants or mockups each time.
              </List.Item>
              <List.Item>
                <b>Reliability:</b> All print and variant details are pre-configured, ensuring correct fulfillment and presentation.
              </List.Item>
              <List.Item>
                <b>Flexibility:</b> Create your own bases for unique or custom products.
              </List.Item>
            </List>
            <Divider />
            <Text variant="headingLg" as="h2">
              Example Product Bases
            </Text>
            <DataTable
              columnContentTypes={["text", "text", "text", "text"]}
              headings={["Name", "Variant", "Print Area Size", "Mockup"]}
              rows={demoRows}
              showTotalsInFooter={false}
            />
            <Text as="p" tone="subdued" variant="bodySm">
              * All Classic T-Shirt variants share the same print area size.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
} 