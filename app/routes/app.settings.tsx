import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  InlineStack,
  Badge,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

import { AppPermissions } from "../components/AppPermissions";

// GraphQL query to get current app scopes
const GET_APP_SCOPES_QUERY = `
  query getCurrentAppScopes {
    currentAppInstallation {
      id
      accessScopes {
        handle
        description
      }
    }
  }
`;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "reauth") {
    // Get the current shop domain
    const shop = session.shop;

    // Get the configured scopes from environment
    const configuredScopes = process.env.SCOPES?.split(",") || [];
    const scopesParam = configuredScopes.join(",");

    // Return the OAuth URL for the component to handle
    const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopesParam}&redirect_uri=${process.env.SHOPIFY_APP_URL}/auth/callback&state=${session.state || 'reauth'}`;

    return Response.json({ redirectUrl: authUrl });
  }

  return Response.json({});
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch current app scopes from Shopify
  const response = await admin.graphql(GET_APP_SCOPES_QUERY);
  const data = await response.json();

  const accessScopes = data?.data?.currentAppInstallation?.accessScopes || [];

  // Get configured scopes from environment to compare
  const configuredScopes = process.env.SCOPES?.split(",") || [];
  const grantedScopeHandles = accessScopes.map((scope: { handle: string }) => scope.handle);

  // Check if there are missing scopes
  const missingScopes = configuredScopes.filter(scope => !grantedScopeHandles.includes(scope));
  const hasNewScopes = missingScopes.length > 0;

  // TODO: Fetch shop settings, quotas, and watermark settings from database
  return {
    shop: session.shop,
    planName: "basic", // Placeholder
    monthlyQuota: 500, // Placeholder
    currentUsage: 0, // Placeholder
    hasWatermark: false, // Placeholder
    watermarkUrl: null, // Placeholder
    accessScopes,
    configuredScopes,
    missingScopes,
    hasNewScopes,
  };
};

export default function SettingsPage() {
  const {
    planName,
    monthlyQuota,
    currentUsage,
    hasWatermark,
    accessScopes,
    configuredScopes,
    missingScopes,
    hasNewScopes
  } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">
                    App Settings & Configuration
                  </Text>

                  <Text variant="bodyMd" as="p">
                    Manage your app preferences, quotas, and shop-specific settings.
                  </Text>
                </BlockStack>
              </Card>

              {/* App Permissions Component */}
              <AppPermissions
                accessScopes={accessScopes}
                configuredScopes={configuredScopes}
                missingScopes={missingScopes}
                hasNewScopes={hasNewScopes}
              />

              {/* Plan & Quota Section */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Plan & Quotas
                  </Text>
                  <Layout>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h4" variant="headingMd" tone="subdued">Current Plan</Text>
                          <Badge tone="info">{planName.charAt(0).toUpperCase() + planName.slice(1)}</Badge>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h4" variant="headingMd" tone="subdued">Monthly Quota</Text>
                          <Text as="p" variant="headingXl">{monthlyQuota}</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneThird">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h4" variant="headingMd" tone="subdued">Usage This Month</Text>
                          <Text as="p" variant="headingXl">{currentUsage}</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>
                </BlockStack>
              </Card>

              {/* Watermark Settings */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">
                      Watermark Settings
                    </Text>
                    <Button variant="primary">
                      Upload New Watermark
                    </Button>
                  </InlineStack>
                  <Text variant="bodyMd" as="p">
                    Upload and manage your shop's watermark/logo. Watermarks are automatically
                    applied to preview images to protect your designs before purchase.
                  </Text>

                  {/* Watermark Status */}
                  <Layout>
                    <Layout.Section variant="oneHalf">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h4" variant="headingMd" tone="subdued">Watermark Status</Text>
                          <Badge tone={hasWatermark ? "success" : "warning"}>
                            {hasWatermark ? "Active" : "No Watermark"}
                          </Badge>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                    <Layout.Section variant="oneHalf">
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h4" variant="headingMd" tone="subdued">Position</Text>
                          <Text as="p" variant="bodyMd">Bottom Right</Text>
                        </BlockStack>
                      </Card>
                    </Layout.Section>
                  </Layout>

                  {!hasWatermark && (
                    <Text variant="bodyMd" as="p" tone="subdued">
                      No watermark configured. Upload your shop logo to automatically watermark all preview images.
                    </Text>
                  )}
                </BlockStack>
              </Card>

              {/* Settings Sections */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Configuration Sections
                  </Text>
                  <List type="bullet">
                    <List.Item>
                      <InlineStack align="space-between">
                        <Text as="span">Shop Settings - Store information and preferences</Text>
                        <Button>Configure</Button>
                      </InlineStack>
                    </List.Item>
                    <List.Item>
                      <InlineStack align="space-between">
                        <Text as="span">API Configuration - External service integrations</Text>
                        <Button>Configure</Button>
                      </InlineStack>
                    </List.Item>
                    <List.Item>
                      <InlineStack align="space-between">
                        <Text as="span">Quota Management - Usage limits and restrictions</Text>
                        <Button>Configure</Button>
                      </InlineStack>
                    </List.Item>
                    <List.Item>
                      <InlineStack align="space-between">
                        <Text as="span">App Preferences - Default settings and behaviors</Text>
                        <Button>Configure</Button>
                      </InlineStack>
                    </List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
