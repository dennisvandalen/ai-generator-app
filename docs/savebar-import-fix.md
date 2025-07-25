# SaveBar Import Fix

## Issue

The application was encountering the following error during build:

```
[vite] Named export 'SaveBar' not found. The requested module '@shopify/polaris' is a CommonJS module, which may not support all module.exports as named exports.
CommonJS modules can always be imported via the default export, for example using:

import pkg from '@shopify/polaris';
const {SaveBar} = pkg;
```

This error occurred because the `SaveBar` component was being incorrectly imported from `@shopify/polaris` in the `ProductDetailPage.tsx` file, but `SaveBar` is not a component provided by Polaris. Instead, it's provided by the Shopify App Bridge library.

## Solution

The fix was to update the import statements in `app/components/ProductDetailPage.tsx` to import `SaveBar` from `@shopify/app-bridge-react` instead of `@shopify/polaris`.

### Before:

```typescript
import {
  Page,
  Layout,
  BlockStack,
  Banner,
  Text,
  SaveBar,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
```

### After:

```typescript
import {
  Page,
  Layout,
  BlockStack,
  Banner,
  Text,
} from "@shopify/polaris";
import { TitleBar, SaveBar } from "@shopify/app-bridge-react";
```

## Explanation

The `SaveBar` component (also known as the Contextual Save Bar) is part of the Shopify App Bridge library, not the Polaris component library. This is why the import from `@shopify/polaris` was failing.

The correct usage can be seen in other files in the project, such as `app/routes/app.styles.$id.tsx`, where `SaveBar` is correctly imported from `@shopify/app-bridge-react`:

```typescript
import { TitleBar, SaveBar, useAppBridge } from "@shopify/app-bridge-react";
```

## References

- [Shopify App Bridge Documentation - Contextual Save Bar](https://shopify.dev/api/app-bridge/previous-versions/actions/contextualsavebar)
- [SHOPIFY_SAVEBAR_GUIDE.md](../SHOPIFY_SAVEBAR_GUIDE.md) in this repository
