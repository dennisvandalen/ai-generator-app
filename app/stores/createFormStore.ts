import { create, type StoreApi } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { produce } from 'immer';
import { deepEqual } from 'fast-equals';

// Export the store's type for use in hooks.
export type FormStore<T extends Record<string, any>> = StoreApi<FormState<T>>;

export interface FormState<T extends Record<string, any>> {
  data: T;
  initialData: T;
  isDirty: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;

  initialize: (initial: T) => void;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  setError: (field: string, message: string) => void;
  clearErrors: () => void;
  startSubmit: () => void;
  finishSubmit: (isSuccess: boolean) => void;
  reset: () => void;
  getChangedFields: () => Partial<T>;
  hasErrors: () => boolean;
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

      setField: (key, value) => set(produce((state) => {
        state.data[key] = value;
        state.isDirty = !deepEqual(state.data, state.initialData);
        // Clear the error for this field as the user is fixing it
        if (state.errors[key as string]) {
          delete state.errors[key as string];
        }
      })),

      setError: (field, message) => set(produce((state) => {
        state.errors[field] = message;
      })),

      clearErrors: () => set({ errors: {} }),

      startSubmit: () => set({ isSubmitting: true }),

      finishSubmit: (isSuccess) => set(produce((state) => {
        state.isSubmitting = false;
        if (isSuccess) {
          state.initialData = { ...state.data };
          state.isDirty = false;
          state.errors = {};
        }
      })),

      reset: () => set(produce((state) => {
        state.data = { ...state.initialData };
        state.isDirty = false;
        state.errors = {};
      })),

      getChangedFields: () => {
        const { data, initialData } = get();
        const changed: Partial<T> = {};
        for (const key in data) {
          if (!deepEqual(data[key], initialData[key])) {
            changed[key] = data[key];
          }
        }
        return changed;
      },

      hasErrors: () => Object.keys(get().errors).length > 0,
    }))
  );
}
