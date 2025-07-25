# Detailed Implementation Examples

This document provides concrete implementation examples for the two recommended approaches to simplify the ProductFormContext.

## Option 1: Immer with useReducer

This approach maintains the current architecture but simplifies state updates using Immer.

```typescript
import { ReactNode, createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { produce } from 'immer';
import { deepEqual } from 'fast-equals';

// Types remain mostly the same, but we can simplify the state structure
interface ProductFormState {
  // Form values
  formValues: {
    product: Product;
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
    editingVariantPrices: Record<string, string>;
  };
  
  // Original values for dirty state comparison
  originalValues: {
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
  };
  
  // Reference data (not part of form state)
  referenceData: {
    shopifyProduct: ShopifyProduct | null;
    aiStyles: AiStyle[];
    productBases: any[];
    productBaseVariants: ProductBaseVariant[];
    productBaseOptions: ProductBaseOption[];
    productBaseVariantOptionValues: ProductBaseVariantOptionValue[];
    shop: string;
    updateNeeded: boolean;
  };
  
  // UI state
  ui: {
    isDirty: boolean;
    isSaving: boolean;
    isLoading: boolean;
    creatingVariants: boolean;
    preventStateReset: boolean;
    actionData: {
      error?: string;
      success?: boolean;
      message?: string;
    } | null;
  };
}

// Action types can remain the same
type ProductFormAction = 
  | { type: 'TOGGLE_ENABLED'; payload: boolean }
  | { type: 'SET_PRODUCT_DATA'; payload: Product }
  // ... other action types
  | { type: 'INITIALIZE'; payload: any };

// Simplified reducer with Immer
function productFormReducer(state: ProductFormState, action: ProductFormAction): ProductFormState {
  return produce(state, draft => {
    switch (action.type) {
      case 'TOGGLE_ENABLED':
        draft.formValues.isEnabled = action.payload;
        break;
        
      case 'SET_PRODUCT_DATA':
        draft.formValues.product = action.payload;
        break;
        
      case 'SET_SELECTED_STYLES':
        draft.formValues.selectedStyles = action.payload;
        break;
        
      case 'TOGGLE_STYLE': {
        const { styleId, checked } = action.payload;
        const styles = draft.formValues.selectedStyles;
        
        if (checked) {
          if (!styles.includes(styleId)) {
            styles.push(styleId);
          }
        } else {
          const index = styles.indexOf(styleId);
          if (index !== -1) {
            styles.splice(index, 1);
          }
        }
        break;
      }
      
      case 'REORDER_STYLES': {
        const { styleUuid, newIndex } = action.payload;
        const styles = draft.formValues.selectedStyles;
        const oldIndex = styles.indexOf(styleUuid);
        
        if (oldIndex !== -1 && newIndex >= 0 && newIndex < styles.length) {
          styles.splice(oldIndex, 1);
          styles.splice(newIndex, 0, styleUuid);
        }
        break;
      }
      
      // Similar pattern for other actions...
      
      case 'UPDATE_ORIGINAL_STATE':
        draft.originalValues = {
          isEnabled: draft.formValues.isEnabled,
          selectedStyles: [...draft.formValues.selectedStyles],
          selectedProductBases: [...draft.formValues.selectedProductBases],
          variantMappings: JSON.parse(JSON.stringify(draft.formValues.variantMappings)),
        };
        break;
        
      case 'RESET_FORM':
        draft.formValues = {
          ...draft.formValues,
          isEnabled: draft.originalValues.isEnabled,
          selectedStyles: [...draft.originalValues.selectedStyles],
          selectedProductBases: [...draft.originalValues.selectedProductBases],
          variantMappings: JSON.parse(JSON.stringify(draft.originalValues.variantMappings)),
          editingVariantPrices: {},
        };
        draft.ui.actionData = null;
        break;
        
      case 'INITIALIZE':
        const payload = action.payload;
        
        draft.formValues = {
          product: payload.product,
          isEnabled: payload.isEnabled,
          selectedStyles: payload.selectedStyles,
          selectedProductBases: payload.selectedProductBases,
          variantMappings: payload.variantMappings,
          editingVariantPrices: {},
        };
        
        draft.originalValues = {
          isEnabled: payload.isEnabled,
          selectedStyles: [...payload.selectedStyles],
          selectedProductBases: [...payload.selectedProductBases],
          variantMappings: JSON.parse(JSON.stringify(payload.variantMappings)),
        };
        
        draft.referenceData = {
          shopifyProduct: payload.shopifyProduct,
          aiStyles: payload.aiStyles,
          productBases: payload.productBases,
          productBaseVariants: payload.productBaseVariants,
          productBaseOptions: payload.productBaseOptions,
          productBaseVariantOptionValues: payload.productBaseVariantOptionValues,
          shop: payload.shop,
          updateNeeded: payload.updateNeeded,
        };
        
        draft.ui = {
          isDirty: false,
          isSaving: false,
          isLoading: false,
          creatingVariants: false,
          preventStateReset: false,
          actionData: null,
        };
        break;
    }
  });
}

// The rest of the context implementation remains similar
export function ProductFormProvider({ children, initialValues, onSubmit }: ProductFormProviderProps) {
  const [state, dispatch] = useReducer(productFormReducer, initialState);
  
  // Compute dirty state
  useEffect(() => {
    const isDirty = !deepEqual(
      {
        isEnabled: state.formValues.isEnabled,
        selectedStyles: state.formValues.selectedStyles,
        selectedProductBases: state.formValues.selectedProductBases,
        variantMappings: state.formValues.variantMappings,
      },
      state.originalValues
    );
    
    if (isDirty !== state.ui.isDirty) {
      dispatch(produce(state, draft => {
        draft.ui.isDirty = isDirty;
      }));
    }
  }, [
    state.formValues.isEnabled,
    state.formValues.selectedStyles,
    state.formValues.selectedProductBases,
    state.formValues.variantMappings,
    state.originalValues,
    state.ui.isDirty
  ]);
  
  // Helper functions remain similar
  // ...
}
```

### Key Improvements:

1. **Simplified State Updates**: No more verbose spread operators
2. **Cleaner State Structure**: More intuitive organization
3. **Immutability Handled by Immer**: Can use direct mutations
4. **Minimal Changes to Architecture**: Keeps the familiar pattern

## Option 2: Zustand Implementation

This approach completely replaces the Context + useReducer pattern with Zustand.

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { deepEqual } from 'fast-equals';

// Define the store state
interface ProductFormState {
  // Form values
  product: Product;
  isEnabled: boolean;
  selectedStyles: string[];
  selectedProductBases: string[];
  variantMappings: VariantMapping[];
  editingVariantPrices: Record<string, string>;
  
  // Original values for dirty state comparison
  originalValues: {
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
  };
  
  // Reference data
  shopifyProduct: ShopifyProduct | null;
  aiStyles: AiStyle[];
  productBases: any[];
  productBaseVariants: ProductBaseVariant[];
  productBaseOptions: ProductBaseOption[];
  productBaseVariantOptionValues: ProductBaseVariantOptionValue[];
  shop: string;
  updateNeeded: boolean;
  
  // UI state
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  creatingVariants: boolean;
  preventStateReset: boolean;
  actionData: {
    error?: string;
    success?: boolean;
    message?: string;
  } | null;
  
  // Actions
  initialize: (values: any) => void;
  toggleEnabled: (checked: boolean) => void;
  setProductData: (product: Product) => void;
  toggleStyle: (styleId: string, checked: boolean) => void;
  setSelectedStyles: (styles: string[]) => void;
  reorderStyles: (styleUuid: string, newIndex: number) => void;
  toggleProductBase: (productBaseId: string, checked: boolean) => void;
  setSelectedProductBases: (productBases: string[]) => void;
  updateVariantMapping: (productBaseVariantId: number, shopifyVariantId: string | null) => void;
  setVariantMappings: (mappings: VariantMapping[]) => void;
  clearOrphanedMappings: (productBaseVariantIds: number[]) => void;
  setEditingVariantPrice: (variantId: string, price: string | null) => void;
  updateVariantPrice: (variantId: string, price: string) => void;
  createVariant: (productBaseVariantId: number, options: Array<{ name: string; value: string }>) => void;
  deleteVariant: (variantId: string) => void;
  setSaving: (isSaving: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setCreatingVariants: (isCreating: boolean) => void;
  setActionResult: (result: { success?: boolean; error?: string; message?: string } | null) => void;
  setPreventStateReset: (prevent: boolean) => void;
  resetForm: () => void;
  updateOriginalState: () => void;
  submitForm: (onSubmit: (formData: FormData) => void) => void;
}

// Create the store
const useProductFormStore = create<ProductFormState>()(
  immer((set, get) => ({
    // Initial state
    product: { id: 0, uuid: '', title: '', shopifyProductId: '', isEnabled: false, createdAt: '', updatedAt: '' },
    isEnabled: false,
    selectedStyles: [],
    selectedProductBases: [],
    variantMappings: [],
    editingVariantPrices: {},
    
    originalValues: {
      isEnabled: false,
      selectedStyles: [],
      selectedProductBases: [],
      variantMappings: [],
    },
    
    shopifyProduct: null,
    aiStyles: [],
    productBases: [],
    productBaseVariants: [],
    productBaseOptions: [],
    productBaseVariantOptionValues: [],
    shop: '',
    updateNeeded: false,
    
    isDirty: false,
    isSaving: false,
    isLoading: false,
    creatingVariants: false,
    preventStateReset: false,
    actionData: null,
    
    // Actions
    initialize: (values) => set((state) => {
      state.product = values.product;
      state.isEnabled = values.isEnabled;
      state.selectedStyles = values.selectedStyles;
      state.selectedProductBases = values.selectedProductBases;
      state.variantMappings = values.variantMappings;
      state.editingVariantPrices = {};
      
      state.originalValues = {
        isEnabled: values.isEnabled,
        selectedStyles: [...values.selectedStyles],
        selectedProductBases: [...values.selectedProductBases],
        variantMappings: JSON.parse(JSON.stringify(values.variantMappings)),
      };
      
      state.shopifyProduct = values.shopifyProduct;
      state.aiStyles = values.aiStyles;
      state.productBases = values.productBases;
      state.productBaseVariants = values.productBaseVariants;
      state.productBaseOptions = values.productBaseOptions;
      state.productBaseVariantOptionValues = values.productBaseVariantOptionValues;
      state.shop = values.shop;
      state.updateNeeded = values.updateNeeded;
      
      state.isDirty = false;
      state.isSaving = false;
      state.isLoading = false;
      state.creatingVariants = false;
      state.preventStateReset = false;
      state.actionData = null;
    }),
    
    toggleEnabled: (checked) => set((state) => {
      state.isEnabled = checked;
      
      // Automatically compute dirty state
      state.isDirty = !deepEqual(
        {
          isEnabled: state.isEnabled,
          selectedStyles: state.selectedStyles,
          selectedProductBases: state.selectedProductBases,
          variantMappings: state.variantMappings,
        },
        state.originalValues
      );
    }),
    
    toggleStyle: (styleId, checked) => set((state) => {
      if (checked) {
        if (!state.selectedStyles.includes(styleId)) {
          state.selectedStyles.push(styleId);
        }
      } else {
        const index = state.selectedStyles.indexOf(styleId);
        if (index !== -1) {
          state.selectedStyles.splice(index, 1);
        }
      }
      
      // Automatically compute dirty state
      state.isDirty = !deepEqual(
        {
          isEnabled: state.isEnabled,
          selectedStyles: state.selectedStyles,
          selectedProductBases: state.selectedProductBases,
          variantMappings: state.variantMappings,
        },
        state.originalValues
      );
    }),
    
    // Other actions follow the same pattern...
    
    resetForm: () => set((state) => {
      state.isEnabled = state.originalValues.isEnabled;
      state.selectedStyles = [...state.originalValues.selectedStyles];
      state.selectedProductBases = [...state.originalValues.selectedProductBases];
      state.variantMappings = JSON.parse(JSON.stringify(state.originalValues.variantMappings));
      state.editingVariantPrices = {};
      state.actionData = null;
      state.isDirty = false;
    }),
    
    updateOriginalState: () => set((state) => {
      state.originalValues = {
        isEnabled: state.isEnabled,
        selectedStyles: [...state.selectedStyles],
        selectedProductBases: [...state.selectedProductBases],
        variantMappings: JSON.parse(JSON.stringify(state.variantMappings)),
      };
      state.isDirty = false;
    }),
    
    submitForm: (onSubmit) => {
      const state = get();
      
      // Update original state
      state.updateOriginalState();
      
      // Set flags
      state.setPreventStateReset(true);
      state.setSaving(true);
      
      // Create form data
      const formData = new FormData();
      formData.append("action", "save_product_settings");
      formData.append("isEnabled", state.isEnabled.toString());
      formData.append("selectedStyles", JSON.stringify(state.selectedStyles));
      formData.append("selectedProductBases", JSON.stringify(state.selectedProductBases));
      
      // Include reordered styles data
      const reorderedStyles = state.selectedStyles.map((styleUuid, index) => ({
        uuid: styleUuid,
        sortOrder: index,
      }));
      formData.append("reorderedStyles", JSON.stringify(reorderedStyles));
      
      // Include variant mappings
      const mappings = state.variantMappings.map(mapping => ({
        productBaseVariantId: mapping.productBaseVariantId,
        shopifyVariantId: mapping.shopifyVariantId,
      }));
      formData.append("variantMappings", JSON.stringify(mappings));
      
      // Submit the form
      onSubmit(formData);
      
      // Reset the preventStateReset flag after a delay
      setTimeout(() => {
        state.setPreventStateReset(false);
      }, 2000);
    },
    
    // Other actions...
  }))
);

// Create a component wrapper for compatibility with the existing code
export function ProductFormProvider({ children, initialValues, onSubmit }: ProductFormProviderProps) {
  const store = useProductFormStore();
  
  // Initialize the store with values
  useEffect(() => {
    if (!store.preventStateReset) {
      store.initialize(initialValues);
    }
  }, [initialValues, store.preventStateReset]);
  
  // Create a value object that matches the current context API
  const value = {
    state: {
      current: {
        product: store.product,
        isEnabled: store.isEnabled,
        selectedStyles: store.selectedStyles,
        selectedProductBases: store.selectedProductBases,
        variantMappings: store.variantMappings,
        editingVariantPrices: store.editingVariantPrices,
      },
      original: store.originalValues,
      data: {
        shopifyProduct: store.shopifyProduct,
        aiStyles: store.aiStyles,
        productBases: store.productBases,
        productBaseVariants: store.productBaseVariants,
        productBaseOptions: store.productBaseOptions,
        productBaseVariantOptionValues: store.productBaseVariantOptionValues,
        shop: store.shop,
        updateNeeded: store.updateNeeded,
      },
      ui: {
        isDirty: store.isDirty,
        isSaving: store.isSaving,
        isLoading: store.isLoading,
        creatingVariants: store.creatingVariants,
        preventStateReset: store.preventStateReset,
        actionData: store.actionData,
      },
    },
    dispatch: () => {}, // Not used with Zustand
    toggleEnabled: store.toggleEnabled,
    setProductData: store.setProductData,
    toggleStyle: store.toggleStyle,
    setSelectedStyles: store.setSelectedStyles,
    reorderStyles: store.reorderStyles,
    toggleProductBase: store.toggleProductBase,
    setSelectedProductBases: store.setSelectedProductBases,
    updateVariantMapping: store.updateVariantMapping,
    setVariantMappings: store.setVariantMappings,
    clearOrphanedMappings: store.clearOrphanedMappings,
    setEditingVariantPrice: store.setEditingVariantPrice,
    updateVariantPrice: store.updateVariantPrice,
    createVariant: store.createVariant,
    deleteVariant: store.deleteVariant,
    setSaving: store.setSaving,
    setLoading: store.setLoading,
    setCreatingVariants: store.setCreatingVariants,
    setActionResult: store.setActionResult,
    setPreventStateReset: store.setPreventStateReset,
    resetForm: store.resetForm,
    submitForm: () => store.submitForm(onSubmit),
    isDirty: store.isDirty,
    isLoading: store.isLoading,
    isSaving: store.isSaving,
    creatingVariants: store.creatingVariants,
    hasError: !!store.actionData?.error,
    errorMessage: store.actionData?.error,
    successMessage: store.actionData?.message,
  };
  
  return (
    <ProductFormContext.Provider value={value}>
      {children}
    </ProductFormContext.Provider>
  );
}

// For direct usage without the context wrapper
export function useProductFormStore() {
  return useProductFormStore();
}

// Keep the existing hook for backward compatibility
export function useProductForm() {
  const context = useContext(ProductFormContext);
  
  if (context === undefined) {
    throw new Error('useProductForm must be used within a ProductFormProvider');
  }
  
  return context;
}
```

### Key Improvements:

1. **Actions Co-located with State**: No need for separate reducer and action creators
2. **Automatic Dirty State**: Computed directly in each action
3. **Simplified API**: More intuitive state access
4. **Immutability Handled by Immer**: Can use direct mutations
5. **No Context Needed**: Can use the store directly in components

## Option 3: Per-Field Dirty State Tracking

This approach focuses on tracking dirty state at a more granular level.

```typescript
import { useReducer, useEffect } from 'react';
import { produce } from 'immer';
import { deepEqual } from 'fast-equals';

// Simplified state structure with per-field dirty tracking
interface ProductFormState {
  // Form values
  values: {
    product: Product;
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
    editingVariantPrices: Record<string, string>;
  };
  
  // Original values
  originalValues: {
    product: Product;
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
  };
  
  // Track which fields are dirty
  dirtyFields: {
    isEnabled: boolean;
    selectedStyles: boolean;
    selectedProductBases: boolean;
    variantMappings: boolean;
  };
  
  // Reference data
  referenceData: {
    // ... same as before
  };
  
  // UI state
  ui: {
    isDirty: boolean; // Computed from dirtyFields
    isSaving: boolean;
    isLoading: boolean;
    // ... other UI state
  };
}

// Reducer with per-field dirty tracking
function productFormReducer(state, action) {
  return produce(state, draft => {
    switch (action.type) {
      case 'TOGGLE_ENABLED':
        draft.values.isEnabled = action.payload;
        draft.dirtyFields.isEnabled = draft.values.isEnabled !== draft.originalValues.isEnabled;
        draft.ui.isDirty = Object.values(draft.dirtyFields).some(Boolean);
        break;
        
      case 'SET_SELECTED_STYLES':
        draft.values.selectedStyles = action.payload;
        draft.dirtyFields.selectedStyles = !deepEqual(
          draft.values.selectedStyles,
          draft.originalValues.selectedStyles
        );
        draft.ui.isDirty = Object.values(draft.dirtyFields).some(Boolean);
        break;
        
      // Other actions follow the same pattern...
    }
  });
}
```

### Key Benefits:

1. **Granular Dirty State**: Know exactly which fields are dirty
2. **Efficient Updates**: Only check equality for changed fields
3. **Better UX Possibilities**: Can highlight specific dirty fields in the UI
4. **Simplified Reset**: Can reset individual fields

## Recommendation

Based on the detailed implementations, here are the recommendations:

1. **For Minimal Changes**: Use Option 1 (Immer with useReducer)
   - Simplifies state updates while keeping the familiar pattern
   - Requires minimal refactoring
   - Addresses the most pressing pain points

2. **For Best Long-Term Solution**: Use Option 2 (Zustand)
   - Provides the cleanest and most maintainable code
   - Eliminates the need for complex context setup
   - Combines the benefits of Immer with a more intuitive API

3. **For Specific UX Requirements**: Consider Option 3 (Per-Field Dirty State)
   - Provides more granular control over dirty state
   - Enables better user feedback
   - Can be combined with either Option 1 or 2
