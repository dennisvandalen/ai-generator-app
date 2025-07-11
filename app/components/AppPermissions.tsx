import { useFetcher } from "@remix-run/react";
import {
  Card,
  BlockStack,
  Button,
  InlineStack,
  Badge,
  List,
  Banner,
  Text,
  Layout,
} from "@shopify/polaris";
import { useEffect } from "react";

interface AccessScope {
  handle: string;
  description: string;
}

interface AppPermissionsProps {
  accessScopes: AccessScope[];
  configuredScopes: string[];
  missingScopes: string[];
  hasNewScopes: boolean;
}

export function AppPermissions({ 
  accessScopes, 
  configuredScopes, 
  missingScopes, 
  hasNewScopes 
}: AppPermissionsProps) {
  const fetcher = useFetcher<{ redirectUrl?: string }>();
  
  // Extract granted scope handles for comparison
  const grantedScopeHandles = accessScopes.map((scope) => scope.handle);

  const handleReauth = () => {
    // Trigger the action to get the OAuth URL
    const formData = new FormData();
    formData.append("action", "reauth");
    fetcher.submit(formData, { method: "post" });
  };

  // When fetcher returns with redirect data, navigate to OAuth URL
  useEffect(() => {
    if (fetcher.data?.redirectUrl) {
      // Use App Bridge navigation for external OAuth URL
      open(fetcher.data.redirectUrl, '_top');
    }
  }, [fetcher.data]);

  return (
    <BlockStack gap="500">
      {/* Scope Re-authentication Section */}
      {hasNewScopes && (
        <Card>
          <BlockStack gap="400">
            <Banner
              title="New Permissions Required"
              action={{
                content: "Re-authenticate",
                onAction: handleReauth,
                loading: fetcher.state === "submitting",
              }}
              tone="warning"
            >
              <Text as="p" variant="bodyMd">
                This app has been updated with new features that require additional permissions. 
                Please re-authenticate to grant the following new scopes: {missingScopes.join(", ")}
              </Text>
            </Banner>
          </BlockStack>
        </Card>
      )}

      {/* Current App Scopes Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text as="h3" variant="headingMd">
              Current App Permissions
            </Text>
            <Button 
              variant="secondary" 
              onClick={handleReauth}
              loading={fetcher.state === "submitting"}
            >
              Re-authenticate
            </Button>
          </InlineStack>
          <Text variant="bodyMd" as="p">
            These are the current access scopes granted to this app by your Shopify store.
          </Text>
          
          {/* Scope Status Summary */}
          <Layout>
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="200">
                  <Text as="h4" variant="headingMd" tone="subdued">Granted Scopes</Text>
                  <Text as="p" variant="headingXl">{accessScopes.length}</Text>
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="200">
                  <Text as="h4" variant="headingMd" tone="subdued">Configured Scopes</Text>
                  <Text as="p" variant="headingXl">{configuredScopes.length}</Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
          
          {/* Granted Scopes List */}
          {accessScopes.length > 0 ? (
            <BlockStack gap="300">
              <Text as="h4" variant="headingMd">Granted Permissions</Text>
              <List type="bullet">
                {accessScopes.map((scope) => (
                  <List.Item key={scope.handle}>
                    <BlockStack gap="100">
                      <InlineStack gap="200" align="start">
                        <Badge tone="success">{scope.handle}</Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {scope.description}
                      </Text>
                    </BlockStack>
                  </List.Item>
                ))}
              </List>
            </BlockStack>
          ) : (
            <Text variant="bodyMd" as="p" tone="subdued">
              No access scopes found or unable to fetch scope information.
            </Text>
          )}

          {/* Missing Scopes List */}
          {hasNewScopes && (
            <BlockStack gap="300">
              <Text as="h4" variant="headingMd">Missing Permissions</Text>
              <List type="bullet">
                {missingScopes.map((scope) => (
                  <List.Item key={scope}>
                    <BlockStack gap="100">
                      <InlineStack gap="200" align="start">
                        <Badge tone="warning">{scope}</Badge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        This scope is configured but not yet granted.
                      </Text>
                    </BlockStack>
                  </List.Item>
                ))}
              </List>
            </BlockStack>
          )}

          {/* All Configured Scopes */}
          <BlockStack gap="300">
            <Text as="h4" variant="headingMd">All Configured Scopes</Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              These are all the scopes your app is configured to request:
            </Text>
            <InlineStack gap="200" wrap>
              {configuredScopes.map((scope) => (
                <Badge 
                  key={scope} 
                  tone={grantedScopeHandles.includes(scope) ? "success" : "warning"}
                >
                  {scope}
                </Badge>
              ))}
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
} 