/**
 * Configuration options for creating theme editor deeplinks
 */
interface ThemeEditorDeeplinkOptions {
  /** The shop domain (without .myshopify.com) */
  shop: string;
  /** Your app's key from Partner Dashboard */
  appKey: string;
  /** Template to open in theme editor */
  template?: 'product' | 'collection' | 'index' | 'page' | 'blog' | 'article' | string;
  /** Product handle for preview (when template is 'product') */
  productHandle?: string;
  /** Collection handle for preview (when template is 'collection') */
  collectionHandle?: string;
  /** Page handle for preview (when template is 'page') */
  pageHandle?: string;
  /** Blog handle for preview (when template is 'blog') */
  blogHandle?: string;
  /** Article handle for preview (when template is 'article') */
  articleHandle?: string;
  /** Custom preview path */
  previewPath?: string;
  /** Specific theme ID (defaults to 'current') */
  themeId?: string | number;
  /** App block ID to activate */
  appBlockId?: string;
  /** Additional query parameters */
  additionalParams?: Record<string, string> & {
    /** Context for the theme editor */
    context?: string;
    /** App ID for activating app embed blocks (format: appKey/blockHandle) */
    activateAppId?: string;
    /** App embed parameter for theme editor (format: appKey/blockHandle) */
    appEmbed?: string;
  };
}

/**
 * Result of the deeplink creation
 */
interface DeeplinkResult {
  /** The complete deeplink URL */
  url: string;
  /** Success status */
  success: boolean;
  /** Error message if creation failed */
  error?: string;
}

/**
 * Configuration for theme extension verification
 */
interface ThemeExtensionCheckOptions {
  /** Shop domain (without .myshopify.com) */
  shop: string;
  /** Shopify Admin API access token */
  accessToken: string;
  /** Your app's key from Partner Dashboard */
  appKey: string;
  /** Specific theme ID to check (optional, defaults to main theme) */
  themeId?: string | number;
  /** App block type/name to look for */
  appBlockType?: string;
}

/**
 * Result of theme extension verification
 */
interface ThemeExtensionStatus {
  /** Whether the extension is enabled */
  isEnabled: boolean;
  /** Whether the extension is installed but not enabled */
  isInstalled: boolean;
  /** Theme information */
  theme: {
    id: number;
    name: string;
    role: string;
  };
  /** App blocks found in theme */
  appBlocks: Array<{
    type: string;
    settings: Record<string, any>;
    disabled?: boolean;
  }>;
  /** Templates where the app block is active */
  activeTemplates: string[];
  /** Error message if verification failed */
  error?: string;
}

/**
 * Creates a deeplink URL to open the Shopify theme editor with app embed activated
 */
export function createThemeEditorDeeplink(
  options: ThemeEditorDeeplinkOptions
): DeeplinkResult {
  try {
    const {
      shop,
      appKey,
      template = 'index',
      productHandle,
      collectionHandle,
      pageHandle,
      blogHandle,
      articleHandle,
      previewPath,
      themeId = 'current',
      appBlockId,
      additionalParams = {}
    } = options;

    // Validate required parameters
    if (!shop || !appKey) {
      return {
        url: '',
        success: false,
        error: 'Shop domain and app key are required'
      };
    }

    // Clean shop domain
    const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');

    // Build base URL
    const baseUrl = `https://${cleanShop}.myshopify.com/admin/themes/${themeId}/editor`;

    // Build query parameters (exclude special params we handle separately)
    const { context, appEmbed, activateAppId, ...otherParams } = additionalParams;
    const params = new URLSearchParams({
      template,
      ...otherParams
    });

    // Add context if not already provided
    if (!context) {
      params.append('context', 'apps');
    } else {
      params.append('context', context);
    }

    // Add appropriate activation parameter
    if (appEmbed) {
      // For app embed blocks using appEmbed parameter
      params.append('appEmbed', appEmbed);
    } else if (activateAppId) {
      // For app embed blocks using legacy activateAppId parameter
      params.append('activateAppId', activateAppId);
    } else {
      // For general app activation
      params.append('activateAppKey', appKey);
    }

    // Add app block ID if provided
    if (appBlockId) {
      params.append('addAppBlockId', appBlockId);
    }

    // Determine preview path
    let finalPreviewPath = previewPath;

    if (!finalPreviewPath) {
      switch (template) {
        case 'product':
          if (productHandle) {
            finalPreviewPath = `/products/${productHandle}`;
          }
          break;
        case 'collection':
          if (collectionHandle) {
            finalPreviewPath = `/collections/${collectionHandle}`;
          }
          break;
        case 'page':
          if (pageHandle) {
            finalPreviewPath = `/pages/${pageHandle}`;
          }
          break;
        case 'blog':
          if (blogHandle) {
            finalPreviewPath = `/blogs/${blogHandle}`;
          }
          break;
        case 'article':
          if (blogHandle && articleHandle) {
            finalPreviewPath = `/blogs/${blogHandle}/${articleHandle}`;
          }
          break;
      }
    }

    // Add preview path if available
    if (finalPreviewPath) {
      params.append('previewPath', finalPreviewPath);
    }

    const url = `${baseUrl}?${params.toString()}`;

    return {
      url,
      success: true
    };

  } catch (error) {
    return {
      url: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Verifies if a theme extension is enabled in the current theme using GraphQL Admin API
 */
export async function verifyThemeExtension(
  options: ThemeExtensionCheckOptions
): Promise<ThemeExtensionStatus> {
  const {
    shop,
    accessToken,
    appKey,
    themeId,
    appBlockType
  } = options;

  try {
    const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
    
    const apiVersion = '2024-01';
    const baseUrl = `https://${cleanShop}.myshopify.com/admin/api/${apiVersion}`;

    const headers = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    };

    // Get theme information using GraphQL
    let targetTheme: any;

    if (themeId && themeId !== 'current') {
      // Get specific theme
      const themeResponse = await fetch(`${baseUrl}/themes/${themeId}.json`, { headers });
      if (!themeResponse.ok) {
        throw new Error(`Failed to fetch theme: ${themeResponse.statusText}`);
      }
      const themeData = await themeResponse.json();
      targetTheme = themeData.theme;
    } else {
      // Get main theme
      const themesResponse = await fetch(`${baseUrl}/themes.json`, { headers });
      if (!themesResponse.ok) {
        throw new Error(`Failed to fetch themes: ${themesResponse.statusText}`);
      }
      const themesData = await themesResponse.json();
      const mainTheme = themesData.themes.find((theme: any) => theme.role === 'main');

      if (!mainTheme) {
        throw new Error('No main theme found');
      }
      targetTheme = mainTheme;
    }

    const appBlocks: Array<{
      type: string;
      settings: Record<string, any>;
      disabled?: boolean;
    }> = [];
    const activeTemplates: string[] = [];
    let isEnabled = false;
    let isInstalled = false;

    // Check settings_data.json for app embed blocks (target: body, head, compliance_head)
    try {
      const settingsResponse = await fetch(
        `${baseUrl}/themes/${targetTheme.id}/assets.json?asset[key]=config/settings_data.json`,
        { headers }
      );

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        const settingsContent = settingsData.asset.value;

        if (settingsContent) {
          const settingsConfig = JSON.parse(settingsContent);
          
          // Check app embed blocks in settings_data.json
          if (settingsConfig.current?.blocks) {
            Object.entries(settingsConfig.current.blocks).forEach(([blockId, blockConfig]: [string, any]) => {
              // Check if this block belongs to our app
              if (blockConfig.type && (
                blockConfig.type.includes(appKey) ||
                (appBlockType && blockConfig.type.includes(`/${appBlockType}/`))
              )) {
                isInstalled = true;

                const appBlock = {
                  type: blockConfig.type,
                  settings: blockConfig.settings || {},
                  disabled: blockConfig.disabled || false
                };

                appBlocks.push(appBlock);

                if (!blockConfig.disabled) {
                  isEnabled = true;
                  activeTemplates.push('App Embed');
                }
              }
            });
          }
        }
      }
    } catch (settingsError) {
      console.warn('Could not check settings_data.json for app embed blocks:', settingsError);
    }

    // Check theme assets for app blocks in templates (target: section)
    const assetsResponse = await fetch(`${baseUrl}/themes/${targetTheme.id}/assets.json`, { headers });
    if (!assetsResponse.ok) {
      throw new Error(`Failed to fetch theme assets: ${assetsResponse.statusText}`);
    }
    const assetsData = await assetsResponse.json();
    const assets = assetsData.assets;

    // Look for template JSON files and section group files
    const templateFiles = assets.filter((asset: any) =>
      asset.key.endsWith('.json') &&
      (asset.key.startsWith('templates/') || asset.key.startsWith('sections/'))
    );

    // Check each template file for app blocks (target: section)
    for (const templateFile of templateFiles) {
      try {
        const assetResponse = await fetch(
          `${baseUrl}/themes/${targetTheme.id}/assets.json?asset[key]=${encodeURIComponent(templateFile.key)}`,
          { headers }
        );

        if (!assetResponse.ok) continue;

        const assetData = await assetResponse.json();
        const content = assetData.asset.value;

        if (!content) continue;

        const templateConfig = JSON.parse(content);

        // Check sections for app blocks
        if (templateConfig.sections) {
          Object.entries(templateConfig.sections).forEach(([sectionId, sectionConfig]: [string, any]) => {
            if (sectionConfig.type && sectionConfig.type.includes(appKey)) {
              isInstalled = true;

              const appBlock = {
                type: sectionConfig.type,
                settings: sectionConfig.settings || {},
                disabled: sectionConfig.disabled || false
              };

              appBlocks.push(appBlock);

              if (!sectionConfig.disabled) {
                isEnabled = true;
                activeTemplates.push(templateFile.key);
              }
            }

            // Check blocks within sections
            if (sectionConfig.blocks) {
              Object.entries(sectionConfig.blocks).forEach(([blockId, blockConfig]: [string, any]) => {
                if (blockConfig.type && (
                  blockConfig.type.includes(appKey) ||
                  (appBlockType && blockConfig.type.includes(`/${appBlockType}/`))
                )) {
                  isInstalled = true;

                  const appBlock = {
                    type: blockConfig.type,
                    settings: blockConfig.settings || {},
                    disabled: blockConfig.disabled || false
                  };

                  appBlocks.push(appBlock);

                  if (!blockConfig.disabled) {
                    isEnabled = true;
                    activeTemplates.push(templateFile.key);
                  }
                }
              });
            }
          });
        }

        // Check order for app blocks (for section groups)
        if (templateConfig.order) {
          templateConfig.order.forEach((sectionId: string) => {
            if (templateConfig.sections?.[sectionId]?.type?.includes(appKey)) {
              if (!activeTemplates.includes(templateFile.key)) {
                activeTemplates.push(templateFile.key);
              }
            }
          });
        }

      } catch (parseError) {
        // Skip files that can't be parsed as JSON
        continue;
      }
    }

    return {
      isEnabled,
      isInstalled,
      theme: {
        id: targetTheme.id,
        name: targetTheme.name,
        role: targetTheme.role
      },
      appBlocks,
      activeTemplates: [...new Set(activeTemplates)] // Remove duplicates
    };

  } catch (error) {
    return {
      isEnabled: false,
      isInstalled: false,
      theme: { id: 0, name: '', role: '' },
      appBlocks: [],
      activeTemplates: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}