# React Hook Form State Sharing Patterns

## Overview

This document explores different patterns for sharing form state between components when using React Hook Form, addressing the concern that RHF form state is "local" to the component that creates it.

## State Sharing Approaches

### 1. Form Context Pattern (Recommended)

React Hook Form provides a `FormProvider` that allows sharing form state across component trees.

```typescript
// Parent component with form
import { useForm, FormProvider } from 'react-hook-form';

export function ParentFormComponent() {
  const form = useForm<FormData>({
    defaultValues: { ... }
  });

  return (
    <FormProvider {...form}>
      <ChildComponent />
      <AnotherChildComponent />
      <RHFFormSaveBar />
    </FormProvider>
  );
}

// Child component accessing form
import { useFormContext } from 'react-hook-form';

export function ChildComponent() {
  const { register, watch, setValue, formState } = useFormContext<FormData>();
  
  return (
    <TextField
      {...register("name")}
      error={formState.errors.name?.message}
    />
  );
}
```

### 2. Prop Drilling (Current Zustand Pattern)

Pass form methods down through props - similar to current approach.

```typescript
// Parent
const form = useForm<FormData>();

return (
  <ChildComponent 
    form={form}
    onFieldChange={(field, value) => form.setValue(field, value)}
  />
);

// Child
interface ChildProps {
  form: UseFormReturn<FormData>;
  onFieldChange: (field: keyof FormData, value: any) => void;
}
```

### 3. Controlled Components with State Lifting

Lift form state to parent and pass down values and handlers.

```typescript
// Parent manages all state
const form = useForm<FormData>();
const watchedValues = form.watch();

return (
  <>
    <ChildForm 
      data={watchedValues}
      errors={form.formState.errors}
      onChange={(field, value) => form.setValue(field, value, { shouldDirty: true })}
    />
    <RHFFormSaveBar form={form} />
  </>
);
```

### 4. Custom Hook for Complex Forms

Create a custom hook that encapsulates form logic and exposes needed methods.

```typescript
// Custom hook
export function useProductBaseForm(initialData?: ProductBaseFormData) {
  const form = useForm<ProductBaseFormData>({
    resolver: zodResolver(ProductBaseFormSchema),
    defaultValues: initialData,
  });

  const addVariant = useCallback((variant: ProductBaseVariant) => {
    const currentVariants = form.getValues('variants') || [];
    form.setValue('variants', [...currentVariants, variant], { shouldDirty: true });
  }, [form]);

  const removeVariant = useCallback((index: number) => {
    const currentVariants = form.getValues('variants') || [];
    const newVariants = currentVariants.filter((_, i) => i !== index);
    form.setValue('variants', newVariants, { shouldDirty: true });
  }, [form]);

  return {
    form,
    // Expose specific methods for complex operations
    addVariant,
    removeVariant,
    // Computed values
    hasVariants: form.watch('variants')?.length > 0,
    canAddVariant: form.watch('optionNames')?.length > 0,
  };
}

// Usage in component
export function ProductBaseCreatePage() {
  const { form, addVariant, removeVariant } = useProductBaseForm();
  
  return (
    <FormProvider {...form}>
      <ProductBaseForm onAddVariant={addVariant} />
      <VariantsList onRemoveVariant={removeVariant} />
      <RHFFormSaveBar form={form} />
    </FormProvider>
  );
}
```

## Comparison with Current Zustand Approach

### Current Zustand Pattern
```typescript
// Global store accessible anywhere
const useProductBaseStore = createFormStore<ProductBaseFormData>();

// Any component can access
const form = useForm({
  store: useProductBaseStore,
  // ...
});

// Direct field updates
form.setField("name", value);
```

### RHF Equivalent Patterns

**FormProvider Pattern:**
```typescript
// Parent creates form, children access via context
const form = useForm<ProductBaseFormData>();

return (
  <FormProvider {...form}>
    <ComponentTree />
  </FormProvider>
);

// Child accesses form
const { setValue } = useFormContext<ProductBaseFormData>();
setValue("name", value, { shouldDirty: true });
```

**Custom Hook Pattern:**
```typescript
// Encapsulate form logic in custom hook
const { form, setName, addVariant } = useProductBaseForm();

// Pass specific methods to children
<ChildComponent onNameChange={setName} />
```

## Migration Strategy for Complex Forms

### 1. ProductBaseForm Analysis

The current `ProductBaseForm` component receives form methods via props:

```typescript
interface ProductBaseFormProps {
  form: {
    data: ProductBaseFormData;
    errors: Record<string, string>;
    setField: (field: keyof ProductBaseFormData, value: any) => void;
    // ...
  };
  // ...
}
```

**RHF Migration Options:**

**Option A: FormProvider + useFormContext**
```typescript
// Parent component
<FormProvider {...form}>
  <ProductBaseForm suggestionOptions={suggestions} />
</FormProvider>

// ProductBaseForm becomes much simpler
export function ProductBaseForm({ suggestionOptions }: { suggestionOptions: string[] }) {
  const { register, formState: { errors }, setValue, watch } = useFormContext<ProductBaseFormData>();
  const data = watch();
  
  return (
    <TextField
      {...register("name")}
      error={errors.name?.message}
      // ...
    />
  );
}
```

**Option B: Custom Hook + Prop Interface**
```typescript
// Keep similar interface but with RHF underneath
export function useProductBaseFormInterface(form: UseFormReturn<ProductBaseFormData>) {
  const data = form.watch();
  const { errors } = form.formState;
  
  return {
    data,
    errors,
    setField: (field: keyof ProductBaseFormData, value: any) => 
      form.setValue(field, value, { shouldDirty: true }),
    submit: form.handleSubmit,
    isSubmitting: form.formState.isSubmitting,
  };
}

// Minimal changes to existing component
const formInterface = useProductBaseFormInterface(form);
<ProductBaseForm form={formInterface} suggestionOptions={suggestions} />
```

### 2. Nested Component State (ProductBaseVariantForm)

Current nested component receives callbacks:

```typescript
<ProductBaseVariantForm
  variants={form.data.variants || []}
  optionNames={form.data.optionNames || []}
  onVariantsChange={(variants) => form.setField("variants", variants)}
  errors={form.errors}
/>
```

**RHF Patterns:**

**Array Field Management:**
```typescript
import { useFieldArray } from 'react-hook-form';

function ProductBaseVariantForm() {
  const { control, watch } = useFormContext<ProductBaseFormData>();
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "variants"
  });
  
  const optionNames = watch("optionNames");
  
  return (
    <>
      {fields.map((field, index) => (
        <VariantRow 
          key={field.id}
          index={index}
          onRemove={() => remove(index)}
          optionNames={optionNames}
        />
      ))}
      <Button onClick={() => append(newVariant)}>Add Variant</Button>
    </>
  );
}
```

## Summary: State Sharing is Fully Possible

React Hook Form provides multiple robust patterns for state sharing:

1. **FormProvider/useFormContext** - Best for deeply nested components
2. **Custom hooks** - Best for encapsulating complex form logic
3. **Prop drilling** - Works well for shallow component trees
4. **useFieldArray** - Excellent for dynamic arrays/lists

The main differences from Zustand:
- **Zustand**: Global store accessible anywhere
- **RHF**: Scoped to component tree, but with excellent context/provider patterns

**Verdict**: State sharing is not a limitation for RHF - it's just implemented differently, often with better performance characteristics.