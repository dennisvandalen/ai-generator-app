# Shopify SaveBar Component Guide

## Overview

The SaveBar component provides a native Shopify Admin experience for saving and discarding form changes. It automatically integrates with the Shopify Admin interface and provides better UX than custom buttons.

The Save Bar API can be used in 2 ways:

1. **Automatic Form Detection**: It is automatically configured when you provide the `data-save-bar` attribute to a [`form` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form) and will display the save bar when there are unsaved changes.
2. **Declarative Control**: It can be controlled declaratively through the `SaveBar` component using props or the App Bridge API.

## Key Benefits

- ✅ **Native Shopify Integration**: Seamlessly integrates with Shopify Admin
- ✅ **Automatic Form Detection**: Can automatically detect unsaved changes
- ✅ **Consistent UX**: Provides the same experience as other Shopify Admin pages
- ✅ **Accessibility**: Built-in accessibility features
- ✅ **Loading States**: Native loading and disabled state handling

## Basic Implementation

### 1. Import Required Components

```jsx
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
```

### 2. Basic SaveBar Setup

```jsx
export default function EditPage() {
  const shopify = useAppBridge();
  
  const handleSave = () => {
    // Your save logic here
    shopify.saveBar.hide('my-save-bar');
  };

  const handleDiscard = () => {
    // Your discard logic here  
    shopify.saveBar.hide('my-save-bar');
  };

  return (
    <>
      {/* Your form content */}
      <form data-save-bar onSubmit={handleSave}>
        {/* Form fields */}
      </form>

      {/* Native Shopify SaveBar */}
      <SaveBar id="my-save-bar">
        <button variant="primary" onClick={handleSave}>
          Save
        </button>
        <button onClick={handleDiscard}>
          Discard
        </button>
      </SaveBar>
    </>
  );
}
```

## Complete API Documentation

### SaveBar Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | **Yes** | A unique identifier for the save bar |
| `open` | `boolean` | No | Control visibility declaratively (alternative to API) |
| `discardConfirmation` | `boolean` | No | Whether to show a confirmation dialog when the discard button is clicked |
| `children` | `UISaveBarChildren` | No | HTML `<button>` elements to hook into Save and Discard buttons |

### Button Properties (Children)

When providing `<button>` elements as children, you can use these attributes:

| Attribute | Type | Description |
|-----------|------|-------------|
| `variant="primary"` | `string` | **Required for Save button.** Identifies the primary action |
| `loading=""` | `string` | Show loading state (empty string for true) |
| `disabled` | `boolean` | Disable the button |
| `onClick` | `function` | Click handler |
| `id` | `string` | Optional unique identifier |
| `class` | `string` | Optional CSS class |
| `name` | `string` | Optional name attribute |

**Important**: Use native HTML `<button>` elements, **not** Polaris Button components.

## Usage Patterns

### 1. Automatic Form Integration (Recommended)

Add `data-save-bar` to your form for automatic change detection:

```jsx
export function AutomaticSaveBar() {
  const shopify = useAppBridge();

  const handleSave = () => {
    console.log('Saving');
    shopify.saveBar.hide('my-save-bar');
  };

  const handleDiscard = () => {
    console.log('Discarding');
    shopify.saveBar.hide('my-save-bar');
  };

  return (
    <>
      <form data-save-bar onSubmit={handleSave}>
        {/* Form fields - changes automatically detected */}
        <input type="text" name="title" />
        <textarea name="description"></textarea>
      </form>

      <SaveBar id="my-save-bar">
        <button variant="primary" onClick={handleSave}>Save</button>
        <button onClick={handleDiscard}>Discard</button>
      </SaveBar>
    </>
  );
}
```

### 2. Manual API Control

Control the save bar manually using the App Bridge API:

```jsx
export function ManualSaveBar() {
  const shopify = useAppBridge();

  const handleSave = () => {
    console.log('Saving');
    shopify.saveBar.hide('my-save-bar');
  };

  const handleDiscard = () => {
    console.log('Discarding');
    shopify.saveBar.hide('my-save-bar');
  };

  return (
    <>
      <button onClick={() => shopify.saveBar.show('my-save-bar')}>
        Show Save Bar
      </button>
      <button onClick={() => shopify.saveBar.hide('my-save-bar')}>
        Hide Save Bar
      </button>
      
      <SaveBar id="my-save-bar">
        <button variant="primary" onClick={handleSave}>Save</button>
        <button onClick={handleDiscard}>Discard</button>
      </SaveBar>
    </>
  );
}
```

### 3. Declarative Control with `open` Prop

```jsx
import { useState } from 'react';
import { SaveBar } from '@shopify/app-bridge-react';

export function DeclarativeSaveBar() {
  const [saveBarOpen, setSaveBarOpen] = useState(false);

  return (
    <>
      <button onClick={() => setSaveBarOpen(true)}>Show Save Bar</button>
      
      <SaveBar id="my-save-bar" open={saveBarOpen}>
        <button variant="primary" onClick={() => setSaveBarOpen(false)}>
          Save
        </button>
        <button onClick={() => setSaveBarOpen(false)}>
          Discard
        </button>
      </SaveBar>
    </>
  );
}
```

## Button States and Loading

### Loading States

```jsx
export function LoadingSaveBar() {
  const shopify = useAppBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <button onClick={() => shopify.saveBar.show('my-save-bar')}>
        Show Save Bar
      </button>
      
      <SaveBar id="my-save-bar">
        <button variant="primary" loading={isSubmitting ? "" : undefined}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
        <button loading={isSubmitting ? "" : undefined}>
          Discard
        </button>
      </SaveBar>
    </>
  );
}
```

### Disabled States

```jsx
export function DisabledSaveBar() {
  const shopify = useAppBridge();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <button onClick={() => shopify.saveBar.show('my-save-bar')}>
        Show Save Bar
      </button>
      
      <SaveBar id="my-save-bar">
        <button variant="primary" disabled={isSubmitting}>Save</button>
        <button disabled={isSubmitting}>Discard</button>
      </SaveBar>
    </>
  );
}
```

## Discard Confirmation

### Option 1: Using `discardConfirmation` Prop

```jsx
export function ConfirmationSaveBar() {
  const shopify = useAppBridge();

  const handleDiscard = () => {
    shopify.saveBar.hide('my-save-bar');
  };

  return (
    <>
      <button onClick={() => shopify.saveBar.show('my-save-bar')}>
        Show Save Bar
      </button>
      
      <SaveBar id="my-save-bar" discardConfirmation>
        <button variant="primary" onClick={() => shopify.saveBar.hide('my-save-bar')}>
          Save
        </button>
        <button onClick={handleDiscard}>Discard</button>
      </SaveBar>
    </>
  );
}
```

### Option 2: Manual Confirmation (Recommended)

```jsx
const handleDiscard = useCallback(() => {
  const confirmed = window.confirm('Are you sure you want to discard your changes?');
  if (confirmed) {
    reset(); // Reset form state
    shopify.saveBar.hide('my-save-bar');
  }
}, [reset, shopify.saveBar]);

<SaveBar id="my-save-bar">
  <button variant="primary" onClick={handleSave}>Save</button>
  <button onClick={handleDiscard}>Discard</button>
</SaveBar>
```

**Note**: While `discardConfirmation` is officially supported, manual confirmation gives you more control and may avoid potential console errors in some App Bridge versions.

**Button Types**:
- **SaveBar**: Must use HTML `<button>` elements for App Bridge integration
- **All other UI**: Use Polaris `<Button>` components for consistent styling

## Advanced Implementation with React Hook Form

### Complete Example from Our Style Edit Page

```jsx
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { useForm } from 'react-hook-form';
import { useCallback, useEffect } from 'react';

export default function EditStylePage() {
  const shopify = useAppBridge();
  const { control, handleSubmit, formState: { isDirty, isSubmitting }, reset } = useForm();

  // Show/hide save bar based on form dirty state
  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show('style-edit-save-bar');
    } else {
      shopify.saveBar.hide('style-edit-save-bar');
    }
  }, [isDirty, shopify.saveBar]);

  const handleSave = useCallback(() => {
    handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);
  
  const handleDiscard = useCallback(() => {
    const confirmed = window.confirm('Are you sure you want to discard your changes?');
    if (confirmed) {
      reset(); // Reset form to original values
      shopify.saveBar.hide('style-edit-save-bar');
    }
  }, [reset, shopify.saveBar]);

  return (
    <Page>
      <form data-save-bar onSubmit={handleSubmit(onSubmit)}>
        {/* Your form fields */}
      </form>

      {/* Native Shopify SaveBar */}
      <SaveBar id="style-edit-save-bar">
        <button 
          variant="primary" 
          onClick={handleSave}
          loading={isSubmitting ? "" : undefined}
          disabled={isSubmitting}
        >
          Save Style
        </button>
        <button 
          onClick={handleDiscard}
          disabled={isSubmitting}
        >
          Discard
        </button>
      </SaveBar>
    </Page>
  );
}
```

## Best Practices

### 1. ✅ Use HTML buttons for SaveBar, Polaris Button everywhere else

```jsx
// ✅ Correct - SaveBar requires HTML buttons
<SaveBar id="my-save-bar">
  <button variant="primary" onClick={handleSave}>Save</button>
  <button onClick={handleDiscard}>Discard</button>
</SaveBar>

// ✅ Correct - Use Polaris Button for all other actions
<Button variant="primary" onClick={handleCreate}>Create</Button>
<Button tone="critical" onClick={handleDelete}>Delete</Button>

// ❌ Wrong - Don't use Polaris Button in SaveBar
<SaveBar id="my-save-bar">
  <Button variant="primary" onClick={handleSave}>Save</Button>
  <Button onClick={handleDiscard}>Discard</Button>
</SaveBar>
```

### 2. ✅ Handle discard confirmation manually

```jsx
const handleDiscard = useCallback(() => {
  const confirmed = window.confirm('Are you sure you want to discard your changes?');
  if (confirmed) {
    reset();
    shopify.saveBar.hide('my-save-bar');
  }
}, [reset, shopify.saveBar]);

<SaveBar id="my-save-bar">
  <button variant="primary" onClick={handleSave}>Save</button>
  <button onClick={handleDiscard}>Discard</button>
</SaveBar>
```

### 3. ✅ Handle loading and disabled states

```jsx
<button 
  variant="primary" 
  onClick={handleSave}
  loading={isSubmitting ? "" : undefined}
  disabled={isSubmitting}
>
  Save
</button>
```

### 4. ✅ Hide save bar after successful save

```jsx
useEffect(() => {
  if (actionData?.success) {
    shopify.saveBar.hide('my-save-bar');
    reset(); // Reset form if using react-hook-form
  }
}, [actionData, shopify.saveBar]);
```

### 5. ✅ Show/hide based on form dirty state

```jsx
useEffect(() => {
  if (isDirty) {
    shopify.saveBar.show('my-save-bar');
  } else {
    shopify.saveBar.hide('my-save-bar');
  }
}, [isDirty, shopify.saveBar]);
```

### 6. ✅ Use unique IDs

Each SaveBar instance must have a unique `id` prop:

```jsx
// ✅ Good - unique IDs
<SaveBar id="product-edit-save-bar">...</SaveBar>
<SaveBar id="style-edit-save-bar">...</SaveBar>

// ❌ Bad - duplicate IDs
<SaveBar id="save-bar">...</SaveBar>
<SaveBar id="save-bar">...</SaveBar>
```

## Common Patterns

### Conditional Rendering

```jsx
// Show save bar only when there are changes
<SaveBar id="my-save-bar" open={isDirty}>
  <button variant="primary" onClick={handleSave}>Save</button>
  <button onClick={handleDiscard}>Discard</button>
</SaveBar>
```

### Custom Button Text

```jsx
<SaveBar id="my-save-bar">
  <button variant="primary" onClick={handleSave}>
    {isSubmitting ? 'Updating...' : 'Update Product'}
  </button>
  <button onClick={handleDiscard}>
    Cancel Changes
  </button>
</SaveBar>
```

### Custom Styling (Avoid if possible)

```jsx
// Only if absolutely necessary
<button 
  variant="primary"
  onClick={handleSave}
  style={{ backgroundColor: '#008060' }}
>
  Save
</button>
```

## Migration from Polaris Buttons

### Before (Polaris Buttons)

```jsx
<InlineStack gap="300">
  <Button variant="primary" submit loading={isSubmitting}>
    Update Style
  </Button>
  <Button onClick={handleGoBack}>
    Cancel
  </Button>
</InlineStack>
```

### After (Native SaveBar)

```jsx
const handleDiscard = useCallback(() => {
  const confirmed = window.confirm('Are you sure you want to discard your changes?');
  if (confirmed) {
    reset();
    shopify.saveBar.hide('style-edit-save-bar');
  }
}, [reset, shopify.saveBar]);

<SaveBar id="style-edit-save-bar">
  <button 
    variant="primary" 
    onClick={handleSave}
    loading={isSubmitting ? "" : undefined}
    disabled={isSubmitting}
  >
    Save Style
  </button>
  <button onClick={handleDiscard} disabled={isSubmitting}>
    Discard
  </button>
</SaveBar>
```

## Troubleshooting

### SaveBar not appearing
- Ensure you have a unique `id` prop
- Check that you're calling `shopify.saveBar.show('your-id')`
- Verify `useAppBridge()` is properly imported and called
- Make sure the ID matches between `show()` call and `<SaveBar id>`

### Buttons not working
- Use HTML `<button>` elements, not Polaris `<Button>` components
- Ensure Save button has `variant="primary"`
- Check that click handlers are properly bound
- Verify button elements are direct children of `<SaveBar>`

### Form not detecting changes
- Add `data-save-bar` attribute to your `<form>` element
- Or manually control with `shopify.saveBar.show/hide()`
- Check that form fields have proper `name` attributes

### Console errors about "discardconfirmation" attribute
- The `discardConfirmation` prop is officially supported but may cause warnings
- For more control, implement confirmation manually with `window.confirm()` in your discard handler
- Use a custom modal component for better UX

### Multiple SaveBars not working
- Ensure each SaveBar has a unique `id` prop
- Only show one SaveBar at a time to avoid conflicts
- Hide previous SaveBars before showing new ones

## Related Documentation

- [Shopify SaveBar API](https://shopify.dev/docs/api/app-bridge-library/apis/save-bar)
- [App Bridge React Components](https://shopify.dev/docs/api/app-bridge-library/react-components)
- [UI Save Bar](https://shopify.dev/docs/api/app-bridge-library/web-components/ui-save-bar)
- [Form Element MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form) 