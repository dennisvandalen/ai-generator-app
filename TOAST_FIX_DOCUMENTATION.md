# Fix for Shopify Toast Error in Server Environment

## Issue Description

When navigating to `/app/productbase` while not already in the app, the following error was occurring:

```
Unexpected Server Error

Error: shopify.toast can't be used in a server environment. You likely need to move this code into an Effect.
```

## Root Cause

The issue was in `app/routes/app.productbase.tsx` where the `shopify.toast` API was being referenced in a way that caused it to be accessed during server-side rendering.

Specifically, in the `useEffect` hook, `shopify.toast` was included in the dependency array:

```javascript
useEffect(() => {
  if (actionData?.success && actionData?.message) {
    shopify.toast.show(actionData.message, {duration: 3000});
  }
}, [actionData, shopify.toast]);
```

Even though the toast functionality was correctly placed inside a `useEffect` hook (which only runs on the client), including `shopify.toast` in the dependency array caused React to try to access this client-side API during server-side rendering.

## Solution

The fix involved two changes:

1. Removed `shopify.toast` from the dependency array to prevent React from trying to access it during server-side rendering.

2. Added a safety check `typeof shopify?.toast?.show === 'function'` to ensure that the toast functionality is only accessed when it's available in the client environment.

```javascript
useEffect(() => {
  if (actionData?.success && actionData?.message && typeof shopify?.toast?.show === 'function') {
    shopify.toast.show(actionData.message, {duration: 3000});
  }
}, [actionData]);
```

## Why This Works

- By removing `shopify.toast` from the dependency array, we prevent React from trying to access it during server-side rendering.
- The additional safety check ensures that we only try to use the toast functionality when it's actually available in the client environment.
- The `useEffect` hook still correctly re-runs when `actionData` changes, which is the primary trigger for showing a toast notification.

## Best Practices for Client-Side APIs in React

When working with APIs that are only available in the client (browser) environment:

1. Always place client-side API calls inside `useEffect` hooks.
2. Be careful about what you include in dependency arrays - don't include client-side objects or APIs.
3. Add safety checks to ensure APIs are available before trying to use them.
4. Consider using dynamic imports or lazy loading for client-side only code.

This pattern helps ensure that your React components can be safely rendered on both the server and client without errors.
