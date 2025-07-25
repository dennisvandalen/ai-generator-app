# Shopify Polaris + React Hook Form Integration Guide

## Critical Integration Issue: TextField Components

### ❌ **DOESN'T WORK: Using `register()` spread syntax**

```typescript
// THIS BREAKS - Fields will appear empty
<TextField
  {...register("name")}
  error={errors.name?.message}
/>
```

**Problem**: Shopify Polaris TextField components don't support React Hook Form's uncontrolled `register()` pattern. The spread syntax doesn't properly bind the value and onChange handlers.

### ✅ **CORRECT: Controlled Components Pattern**

```typescript
// THIS WORKS - Proper controlled component
<TextField
  value={formData.name || ""}
  onChange={(value) => setValue("name", value, { shouldDirty: true })}
  error={errors.name?.message}
/>
```

**Requirements**:
1. **`value` prop**: Must be explicitly set using watched form data
2. **`onChange` prop**: Must call `setValue` with `shouldDirty: true`
3. **Form watching**: Must use `watch()` to get reactive form data

## Complete Integration Pattern

### Form Setup
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const form = useForm<FormData>({
  resolver: zodResolver(FormSchema),
  mode: 'onChange', // Enable real-time validation
});

const {
  handleSubmit,
  formState: { errors, isDirty, isSubmitting },
  watch,
  setValue,
  reset,
} = form;

// Watch form data for reactive updates
const formData = watch();
```

### Field Implementation
```typescript
<TextField
  label="Field Label"
  value={formData.fieldName || ""}
  onChange={(value) => setValue("fieldName", value, { shouldDirty: true })}
  error={errors.fieldName?.message}
  helpText="Help text here"
/>
```

### Complex Components (Checkbox, Select, etc.)
```typescript
// Checkbox
<Checkbox
  label="Active"
  checked={formData.isActive || false}
  onChange={(checked) => setValue("isActive", checked, { shouldDirty: true })}
/>

// Select (if using Polaris Select)
<Select
  label="Category"
  options={options}
  value={formData.category || ""}
  onChange={(value) => setValue("category", value, { shouldDirty: true })}
/>
```

## Data Loading Pattern

### Async Data from Remix Loader
```typescript
// Initialize form empty, then populate with reset()
const form = useForm<FormData>({
  resolver: zodResolver(FormSchema),
  mode: 'onChange',
});

// Populate form when loader data is available
useEffect(() => {
  if (loaderData) {
    form.reset({
      field1: loaderData.field1,
      field2: loaderData.field2 || "",
      field3: loaderData.field3 ?? false,
    });
  }
}, [loaderData, form]);
```

**Key Points**:
- Don't use `defaultValues` with async data
- Use `form.reset()` in `useEffect` when data loads
- Always provide fallback values (`|| ""` for strings, `?? false` for booleans)

## Save Bar Integration

### RHF-Compatible Save Bar
```typescript
import { RHFFormSaveBar } from "~/components/RHFFormSaveBar";

<RHFFormSaveBar
  form={form}
  onSave={handleSubmit(onSubmit)}
  onDiscard={() => reset()}
/>
```

### Manual Save Bar (Alternative)
```typescript
<FormSaveBar
  isDirty={form.formState.isDirty}
  isSubmitting={form.formState.isSubmitting}
  hasErrors={Object.keys(form.formState.errors).length > 0}
  onSave={form.handleSubmit(onSubmit)}
  onDiscard={() => form.reset()}
/>
```

## Validation Modes

### Real-time Validation
```typescript
const form = useForm({
  mode: 'onChange',        // Validate on every change
  reValidateMode: 'onChange', // Re-validate on change after first error
});
```

### Other Validation Modes
```typescript
mode: 'onBlur'     // Validate when field loses focus
mode: 'onSubmit'   // Validate only on form submission
mode: 'onTouched'  // Validate after field is touched
```

## Form Submission

### Standard Pattern
```typescript
const onSubmit = handleSubmit((data) => {
  const submitData = { ...data, _action: "update-item" };
  fetcher.submit(submitData, { method: "post", encType: "application/json" });
});

// Handle response
useEffect(() => {
  if (fetcher.state === 'idle' && fetcher.data) {
    if (fetcher.data.success) {
      form.reset(formData); // Mark as clean
      shopify?.toast.show("Saved successfully");
    } else if (fetcher.data.error) {
      // Handle server validation errors
      if (fetcher.data.details) {
        fetcher.data.details.forEach((detail) => {
          form.setError(detail.field, { message: detail.message });
        });
      }
      shopify?.toast.show(fetcher.data.error, { isError: true });
    }
  }
}, [fetcher.state, fetcher.data]);
```

## Component Compatibility Matrix

| Component | `register()` Support | Controlled Required | Pattern |
|-----------|---------------------|-------------------|---------|
| TextField | ❌ | ✅ | `value` + `onChange` |
| Checkbox | ❌ | ✅ | `checked` + `onChange` |
| Select | ❌ | ✅ | `value` + `onChange` |
| RadioButton | ❌ | ✅ | `checked` + `onChange` |
| Combobox | ❌ | ✅ | Custom implementation |

## Performance Considerations

### Watching Specific Fields
```typescript
// Instead of watching all form data
const formData = watch(); // Re-renders on any field change

// Watch specific fields for better performance
const name = watch('name');
const email = watch('email');
```

### Debounced Validation
```typescript
import { debounce } from 'lodash';

const debouncedValidation = useMemo(
  () => debounce((value) => form.trigger('field'), 300),
  [form]
);

<TextField
  value={formData.field || ""}
  onChange={(value) => {
    setValue("field", value, { shouldDirty: true });
    debouncedValidation(value);
  }}
/>
```

## Common Pitfalls

### 1. Empty Fields on Load
**Problem**: Using `register()` with Polaris components
**Solution**: Use controlled components with `watch()` and `setValue()`

### 2. Form Not Marking as Dirty
**Problem**: Forgetting `shouldDirty: true` in `setValue()`
**Solution**: Always include `{ shouldDirty: true }` option

### 3. Validation Not Working
**Problem**: Not setting up `resolver` or `mode`
**Solution**: Always use `zodResolver()` and appropriate validation mode

### 4. Save Bar Not Appearing
**Problem**: Dirty state not tracked properly
**Solution**: Ensure all field changes use `setValue()` with `shouldDirty: true`

## Best Practices

1. **Always use controlled components** with Polaris
2. **Watch form data** for reactive updates
3. **Include `shouldDirty: true`** in all `setValue()` calls
4. **Use `form.reset()`** for async data initialization
5. **Handle server errors** properly in submission effects
6. **Provide fallback values** for all form fields
7. **Use appropriate validation modes** for user experience

## Migration Checklist

When migrating from Zustand to RHF with Polaris:

- [ ] Replace `{...register()}` with controlled component pattern
- [ ] Add `watch()` for form data
- [ ] Update all `onChange` handlers to use `setValue()`
- [ ] Include `shouldDirty: true` in all `setValue()` calls
- [ ] Replace `form.setField()` with `setValue()`
- [ ] Update save bar integration
- [ ] Test field population on page load
- [ ] Verify real-time validation works
- [ ] Test form submission and error handling

This integration pattern ensures React Hook Form works properly with Shopify Polaris components while maintaining all the benefits of RHF's validation and state management.