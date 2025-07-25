import { useCallback, useEffect } from 'react';
import { useFetcher } from '@remix-run/react';
import { useStore } from 'zustand';
import type { z } from 'zod';
import type { FormStore } from '~/stores/createFormStore';

interface UseFormOptions<T> {
  store: FormStore<T>; // IMPROVEMENT: Use the exported generic type for full type-safety.
  schema: z.ZodSchema<T>; // Client-side schema (without _action)
  actionName: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export function useForm<T extends Record<string, any>>({
  store,
  schema,
  actionName,
  onSuccess,
  onError,
}: UseFormOptions<T>) {
  const fetcher = useFetcher();
  // IMPROVEMENT: Use the `useStore` hook for idiomatic state subscription in React.
  const formState = useStore(store);

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const isSuccess = !fetcher.data.error;
      store.getState().finishSubmit(isSuccess);

      if (isSuccess) {
        onSuccess?.(fetcher.data);
      } else {
        // IMPROVEMENT: Handle the new structured error format.
        if (fetcher.data.details && Array.isArray(fetcher.data.details)) {
          fetcher.data.details.forEach((detail: { field: string; message: string }) => {
            store.getState().setError(detail.field, detail.message);
          });
        }
        onError?.(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data, store, onSuccess, onError]);

  // Client-side validation before submission
  const validateClientSide = useCallback((data: T): boolean => {
    store.getState().clearErrors();
    const validation = schema.safeParse(data);
    if (!validation.success) {
      validation.error.issues.forEach((issue) => {
        store.getState().setError(issue.path.join('.'), issue.message);
      });
      return false;
    }
    return true;
  }, [schema, store]);

  const submit = useCallback(async () => {
    const data = store.getState().data;
    if (!validateClientSide(data)) {
      return;
    }
    store.getState().startSubmit();
    fetcher.submit(
      { ...data, _action: actionName },
      { method: 'POST', encType: 'application/json' }
    );
  }, [store, validateClientSide, actionName, fetcher]);

  return {
    data: formState.data,
    initialData: formState.initialData,
    isDirty: formState.isDirty,
    isSubmitting: formState.isSubmitting,
    errors: formState.errors,
    initialize: store.getState().initialize,
    setField: store.getState().setField,
    setError: store.getState().setError,
    clearErrors: store.getState().clearErrors,
    startSubmit: store.getState().startSubmit,
    finishSubmit: store.getState().finishSubmit,
    reset: store.getState().reset,
    getChangedFields: store.getState().getChangedFields,
    hasErrors: store.getState().hasErrors,
    submit,
    isLoading: fetcher.state !== 'idle',
    fetcherData: fetcher.data,
  };
}
