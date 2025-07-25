# Shopify Remix Form System - A Complete Guide (v2)

A reusable, type-safe form system for Shopify Remix apps with JSON actions, Zod validation, and integrated SaveBar. This updated guide incorporates improved type safety, more robust error handling, and clearer patterns for partial form submissions.

## 🏗️ Architecture Overview

This system provides a comprehensive solution for modern form management:

- **JSON-first actions** using a dedicated `_action` field for routing.
- **Shared Zod schemas** for consistent validation on both the client and server.
- **Immediate client-side validation** for a better user experience.
- **Secure server-side validation** that runs after authentication.
- **Reusable form stores (Zustand)** with dirty state tracking.
- **Integrated Shopify `SaveBar`** for a native admin feel.
- **Automatic Shopify context injection** on the server.
- **Structured error handling** built-in.

## 🔄 Client/Server Validation Strategy

The validation strategy ensures both a responsive UI and a secure backend.

**Shared Schemas**: Zod schemas are the single source of truth, defined once and shared between the client and server.

**Client-side**: Provides instant feedback to the user as they type and prevents submissions of invalid data, reducing unnecessary server load.

**Server-side**: Acts as the ultimate security boundary. It re-validates all data after authenticating the user session, ensuring data integrity before it reaches your database or the Shopify API.

**Flow**:

1.  User interacts with a field → The client validates that specific field, showing any errors immediately.
2.  User clicks "Save" → The client validates the entire form. If valid, the data is sent to the server.
3.  The server receives the request → It first authenticates the session, then re-validates the payload against the corresponding Zod schema before executing the business logic.

## 📁 Project Structure

```
schemas/
  product.ts               ← Shared Zod schemas (client + server)
  customer.ts
utils/
  createActionRouter.ts     ← Server-side action routing system
  withZodHandler.ts         ← Server-side validation & auth wrapper
stores/
  createFormStore.ts        ← Client-side Zustand store factory
hooks/
  useForm.ts               ← Client-side form logic abstraction
components/
  FormSaveBar.tsx          ← Client-side SaveBar component
actions/
  [page]/
    update.ts              ← Individual server-side action handlers
    delete.ts
routes/
  products.edit.tsx        ← Page route using the form system
```

## 🛠️ Core Implementation

### 0\. Shared Schemas (`schemas/product.ts`)

Schemas are defined for the base form data, as well as for each server action. Using `.partial()` is critical for actions that handle partial updates.

```typescript
import { z } from 'zod'

// Base schema for the form state (used for client-side validation)
export const ProductFormSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  status: z.enum(['active', 'draft']),
})

// Schema for the 'create' action (omits ID)
export const CreateProductSchema = ProductFormSchema.extend({
  _action: z.literal('create-product'),
}).omit({ id: true })

// Schema for a full 'update' action (requires ID)
export const UpdateProductSchema = ProductFormSchema.extend({
  _action: z.literal('update-product'),
  id: z.string().uuid(), // ID is now required
})

// Schema for a PARTIAL 'update' action.
// Uses .partial() to make all form fields optional.
// This is crucial for submitting only changed fields.
export const UpdatePartialProductSchema = UpdateProductSchema.partial()

// Schema for the 'delete' action
export const DeleteProductSchema = z.object({
  _action: z.literal('delete-product'),
  id: z.string().uuid(),
})

// Type exports for type-safe usage throughout the app
export type ProductFormData = z.infer<typeof ProductFormSchema>
```

### 1\. Action Router (`utils/createActionRouter.ts`) - **SERVER ONLY**

This utility remains a simple and effective way to route incoming JSON requests based on the `_action` field.

```typescript
import { type ActionFunctionArgs, json } from '@remix-run/node'

type HandlerFn = (args: ActionFunctionArgs, payload: any) => Promise<Response>

export function createActionRouter(handlers: Record<string, HandlerFn>) {
  type ActionKey = keyof typeof handlers

  return async function action(args: ActionFunctionArgs) {
    try {
      const body = await args.request.json()
      const actionType = body._action

      if (!actionType || !(actionType in handlers)) {
        return json({ error: 'Invalid _action' }, { status: 400 })
      }

      return handlers[actionType as ActionKey](args, body)
    } catch (error) {
      console.error('Action router error:', error)
      return json({ error: 'Invalid JSON payload' }, { status: 400 })
    }
  }
}
```

### 2\. Zod Handler Wrapper (`utils/withZodHandler.ts`) - **SERVER ONLY**

Updated to return structured error objects for more robust parsing on the client.

```typescript
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { ZodSchema } from 'zod'
import { authenticate } from '~/shopify.server'

export function withZodHandler<T>(
  schema: ZodSchema<T>,
  fn: (args: ActionFunctionArgs, input: T, session: any, admin: any) => Promise<Response>
) {
  return async (args: ActionFunctionArgs, payload: unknown): Promise<Response> => {
    try {
      const { session, admin } = await authenticate.admin(args.request)
      
      if (!session) {
        return json({ error: 'Authentication required' }, { status: 401 })
      }

      const result = schema.safeParse(payload)

      if (!result.success) {
        // IMPROVEMENT: Return a structured array of errors, not a plain string.
        const errors = result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
        return json({ 
          error: 'Validation failed', 
          details: errors // `details` is now an array of objects
        }, { status: 400 })
      }

      return await fn(args, result.data, session, admin)
    } catch (error) {
      console.error('Handler error:', error)
      if (error?.message?.includes('authentication') || error?.status === 401) {
        return json({ error: 'Authentication failed' }, { status: 401 })
      }
      return json({ 
        error: 'An unexpected server error occurred.',
        ...(process.env.NODE_ENV === 'development' && { details: error.message })
      }, { status: 500 })
    }
  }
}
```

### 3\. Form Store Factory (`stores/createFormStore.ts`) - **CLIENT ONLY**

We export the `FormStore` type to ensure the `useForm` hook is fully type-safe.

```typescript
import { create, type StoreApi } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { produce } from 'immer'
import { deepEqual } from 'fast-equals'

// Export the store's type for use in hooks.
export type FormStore<T extends Record<string, any>> = StoreApi<FormState<T>>

export interface FormState<T extends Record<string, any>> {
  data: T
  initialData: T
  isDirty: boolean
  isSubmitting: boolean
  errors: Record<string, string>
  
  initialize: (initial: T) => void
  setField: <K extends keyof T>(key: K, value: T[K]) => void
  setError: (field: string, message: string) => void
  // ... other actions
  reset: () => void
  getChangedFields: () => Partial<T>
  hasErrors: () => boolean
}

export function createFormStore<T extends Record<string, any>>() {
  return create<FormState<T>>()(
    subscribeWithSelector((set, get) => ({
      data: {} as T,
      initialData: {} as T,
      isDirty: false,
      isSubmitting: false,
      errors: {},

      initialize: (initial) => set({
        data: { ...initial },
        initialData: { ...initial },
        isDirty: false,
        isSubmitting: false,
        errors: {},
      }),

      setField: (key, value) => set(produce((state: FormState<T>) => {
        state.data[key] = value
        state.isDirty = !deepEqual(state.data, state.initialData)
        // Clear the error for this field as the user is fixing it
        if (state.errors[key as string]) {
          delete state.errors[key as string]
        }
      })),

      // ... other action implementations from the original document
      getChangedFields: () => {
        const { data, initialData } = get()
        const changed: Partial<T> = {}
        for (const key in data) {
          if (!deepEqual(data[key], initialData[key])) {
            changed[key] = data[key]
          }
        }
        return changed
      },

      hasErrors: () => Object.keys(get().errors).length > 0,
    }))
  )
}
```

### 4\. Form Hook (`hooks/useForm.ts`) - **CLIENT ONLY**

This hook is now fully type-safe and handles structured errors from the server.

```typescript
import { useCallback, useEffect } from 'react'
import { useFetcher } from '@remix-run/react'
import { useStore } from 'zustand'
import { z } from 'zod'
import type { FormStore } from '~/stores/createFormStore'

interface UseFormOptions<T> {
  store: FormStore<T> // IMPROVEMENT: Use the exported generic type for full type-safety.
  schema: z.ZodSchema<T> // Client-side schema (without _action)
  actionName: string
  onSuccess?: (data: any) => void
  onError?: (error: any) => void
}

export function useForm<T extends Record<string, any>>({
  store,
  schema,
  actionName,
  onSuccess,
  onError,
}: UseFormOptions<T>) {
  const fetcher = useFetcher()
  // IMPROVEMENT: Use the `useStore` hook for idiomatic state subscription in React.
  const formState = useStore(store)

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const isSuccess = !fetcher.data.error
      store.getState().finishSubmit(isSuccess)
      
      if (isSuccess) {
        onSuccess?.(fetcher.data)
      } else {
        // IMPROVEMENT: Handle the new structured error format.
        if (fetcher.data.details && Array.isArray(fetcher.data.details)) {
          fetcher.data.details.forEach((detail: { field: string; message: string }) => {
            store.getState().setError(detail.field, detail.message)
          })
        }
        onError?.(fetcher.data.error)
      }
    }
  }, [fetcher.state, fetcher.data, store, onSuccess, onError])

  // Client-side validation before submission
  const validateClientSide = useCallback((data: T): boolean => {
    store.getState().clearErrors()
    const validation = schema.safeParse(data)
    if (!validation.success) {
      validation.error.issues.forEach((issue) => {
        store.getState().setError(issue.path.join('.'), issue.message)
      })
      return false
    }
    return true
  }, [schema, store])

  const submit = useCallback(async () => {
    const data = store.getState().data;
    if (!validateClientSide(data)) {
      return
    }
    store.getState().startSubmit();
    fetcher.submit(
      { ...data, _action: actionName },
      { method: 'POST', encType: 'application/json' }
    )
  }, [store, validateClientSide, actionName, fetcher])

  return {
    ...formState,
    submit,
    isLoading: fetcher.state !== 'idle',
    fetcherData: fetcher.data,
  }
}
```

## 📋 Usage Example

### Product Form Component (`routes/products.edit.tsx`)

This example demonstrates initializing the form and using `useCallback` for stable callbacks.

```typescript
// routes/products.edit.tsx
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { useCallback, useEffect } from 'react'
import { Page, Layout, Card, FormLayout, TextField } from '@shopify/polaris'

// Imports from the system
import { ProductFormSchema, type ProductFormData } from '~/schemas/product'
import { createActionRouter } from '~/utils/createActionRouter'
import { createFormStore } from '~/stores/createFormStore'
import { useForm } from '~/hooks/useForm'
import { FormSaveBar } from '~/components/FormSaveBar'

// Import server-side action handlers
import * as updateProduct from '~/actions/products/update'
import * as deleteProduct from '~/actions/products/delete'

// Create a typed store instance
const useProductStore = createFormStore<ProductFormData>()

// Wire up the action router
export const action = createActionRouter({
  'update-product': updateProduct.action,
  'delete-product': deleteProduct.action,
})

// Load initial data for the form
export async function loader({ params }: LoaderFunctionArgs) {
  const product = await getProduct(params.id); // Your data fetching logic
  return json({ product })
}

export default function ProductEdit() {
  const { product } = useLoaderData<typeof loader>()
  
  // BEST PRACTICE: Wrap callbacks passed to hooks in useCallback.
  const handleSuccess = useCallback(() => {
    // e.g., show a toast notification
    shopify.toast.show('Product saved');
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('Save failed:', error);
    shopify.toast.show(error, { isError: true });
  }, []);
  
  const form = useForm({
    store: useProductStore,
    schema: ProductFormSchema,
    actionName: 'update-product',
    onSuccess: handleSuccess,
    onError: handleError
  })

  // Initialize form state when loader data is available
  useEffect(() => {
    if (product) {
      form.initialize(product)
    }
  }, [product, form.initialize]) // form.initialize is stable

  return (
    <Page title="Edit Product">
      <FormSaveBar
        isDirty={form.isDirty}
        isSubmitting={form.isSubmitting}
        hasErrors={form.hasErrors()}
        onSave={form.submit}
        onDiscard={form.reset}
      />
      <Layout>
        <Layout.Section>
          <Card>
            <FormLayout>
              <TextField
                label="Title"
                value={form.data.title || ''}
                onChange={(value) => form.setField('title', value)}
                error={form.errors.title}
                autoComplete="off"
              />
              {/* ... other form fields ... */}
            </FormLayout>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
```

## 🎯 Best Practices

### 1\. Schema Organization

- Keep related schemas in the same file (e.g., `schemas/product.ts`).
- Create a base schema for the form data and extend it for specific actions (`create`, `update`).
- **Crucially**, use `.partial()` for schemas that handle partial updates to prevent validation errors.

### 2\. Error Handling

- Always handle both server-side validation errors (`details`) and general errors (`error`) in your form hook.
- Display user-friendly error messages from the server directly under the relevant fields.
- Log detailed errors on the server for debugging purposes.

### 3\. Performance

- Memoize callbacks (`onSuccess`, `onError`) passed into `useForm` with `useCallback` to prevent unnecessary re-renders and effect executions.
- For very large forms, consider using the `submitPartial` pattern (by creating a second action with a partial schema) to send only changed data to the server.

### 4\. Type Safety

- **Always** start with the Zod schema as the single source of truth and infer your TypeScript types from it.
- Use the provided generic types (`FormStore`) to ensure full type safety between your stores, hooks, and components.
- Validate data on both the client and the server.

## 📦 Required Dependencies

Install these packages to implement the system:

```bash
npm install zustand immer fast-equals zod
npm install @shopify/app-bridge-react @shopify/polaris
```

- **`zustand`**: For lightweight client-side state management.
- **`immer`**: For safe and simple immutable state updates in Zustand.
- **`fast-equals`**: For efficient deep equality checks to determine if the form is dirty.
- **`zod`**: For schema declaration and validation.
- **`@shopify/app-bridge-react`**: For core Shopify components like `SaveBar`.
- **`@shopify/polaris`**: For the UI component library.
