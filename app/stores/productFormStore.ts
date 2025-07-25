import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { deepEqual } from 'fast-equals';

// Import types from type definitions
import type {
  Product,
  ShopifyProduct,
  AiStyle,
  ProductBaseVariant,
  ProductBaseOption,
  ProductBaseVariantOptionValue,
  VariantMapping
} from '~/types/productForm';

// Define the store state
interface ProductFormState {
  // Form values (current state)
  product: Product;
  isEnabled: boolean;
  selectedStyles: string[];
  selectedProductBases: string[];
  variantMappings: VariantMapping[];
  editingVariantPrices: Record<string, string>;

  // Original values for dirty state comparison
  originalValues: {
    product: Product;
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
  };

  // Reference data (not part of form state, but needed for rendering)
  shopifyProduct: ShopifyProduct | null;
  aiStyles: AiStyle[];
  productBases: any[]; // Using any for now, will define proper type later
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
  // Product settings actions
  toggleEnabled: (checked: boolean) => void;
  setProductData: (product: Product) => void;

  // Style actions
  toggleStyle: (styleId: string, checked: boolean) => void;
  setSelectedStyles: (styles: string[]) => void;
  reorderStyles: (styleUuid: string, newIndex: number) => void;

  // Product base actions
  toggleProductBase: (productBaseId: string, checked: boolean) => void;
  setSelectedProductBases: (productBases: string[]) => void;

  // Variant mapping actions
  updateVariantMapping: (productBaseVariantId: number, shopifyVariantId: string | null) => void;
  setVariantMappings: (mappings: VariantMapping[]) => void;
  clearOrphanedMappings: (productBaseVariantIds: number[]) => void;

  // Variant price actions
  setEditingVariantPrice: (variantId: string, price: string | null) => void;
  updateVariantPrice: (variantId: string, price: string) => void;

  // Variant creation/deletion actions
  createVariant: (productBaseVariantId: number, options: Array<{ name: string; value: string }>) => void;
  deleteVariant: (variantId: string) => void;

  // UI state actions
  setSaving: (isSaving: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setCreatingVariants: (isCreating: boolean) => void;
  setActionResult: (result: { success?: boolean; error?: string; message?: string } | null) => void;
  setPreventStateReset: (prevent: boolean) => void;

  // Form actions
  resetForm: () => void;
  updateOriginalState: () => void;
  initialize: (values: {
    product: Product;
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
    shopifyProduct: ShopifyProduct | null;
    aiStyles: AiStyle[];
    productBases: any[];
    productBaseVariants: ProductBaseVariant[];
    productBaseOptions: ProductBaseOption[];
    productBaseVariantOptionValues: ProductBaseVariantOptionValue[];
    shop: string;
    updateNeeded: boolean;
  }) => void;

  // Submission action
  submitForm: (onSubmit: (data: {
    _action: string;
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    reorderedStyles: Array<{ uuid: string; sortOrder: number }>;
    variantMappings: Array<{ productBaseVariantId: number; shopifyVariantId: string }>;
  }) => void) => void;

  // Computed selectors
  getAvailableProductBaseVariants: () => ProductBaseVariant[];
}

// Helper function to compute dirty state
function computeFormDirtyState(current: any, original: any): boolean {
  return !deepEqual(current, original);
}

// Helper to update dirty state - centralizes the computation
function updateDirtyState(state: any) {
  state.isDirty = computeFormDirtyState(
    {
      product: state.product,
      isEnabled: state.isEnabled,
      selectedStyles: state.selectedStyles,
      selectedProductBases: state.selectedProductBases,
      variantMappings: state.variantMappings
    },
    state.originalValues
  );
}

// Helper to clean up orphaned variant mappings
function cleanupOrphanedMappings(state: any) {
  const selectedProductBaseIds = state.productBases
    .filter((pb: any) => state.selectedProductBases.includes(pb.uuid))
    .map((pb: any) => pb.id);
  
  const validVariantIds = state.productBaseVariants
    .filter((variant: any) => selectedProductBaseIds.includes(variant.productBaseId))
    .map((variant: any) => variant.id);
  
  state.variantMappings = state.variantMappings.filter(
    (mapping: any) => validVariantIds.includes(mapping.productBaseVariantId)
  );
}

// Helper for common form submission pattern
function submitAction(action: string, data: Record<string, any>, state: any) {
  const formData = new FormData();
  formData.append("action", action);
  
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });

  return fetch(window.location.pathname, {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(result => {
    if (result.error) {
      state.setActionResult({ error: result.error });
    } else if (result.success) {
      state.setActionResult({ success: true, message: result.message });
    }
    return result;
  })
  .catch(() => {
    state.setActionResult({ error: "Request failed" });
    throw new Error("Request failed");
  });
}

// Create the store
export const useProductFormStore = create<ProductFormState>()(
  immer((set, get) => ({
    // Initial state - form values
    product: {
      id: 0,
      uuid: '',
      title: '',
      shopifyProductId: '',
      isEnabled: false,
      createdAt: '',
      updatedAt: ''
    },
    isEnabled: false,
    selectedStyles: [],
    selectedProductBases: [],
    variantMappings: [],
    editingVariantPrices: {},

    // Initial state - original values
    originalValues: {
      product: {
        id: 0,
        uuid: '',
        title: '',
        shopifyProductId: '',
        isEnabled: false,
        createdAt: '',
        updatedAt: ''
      },
      isEnabled: false,
      selectedStyles: [],
      selectedProductBases: [],
      variantMappings: []
    },

    // Initial state - reference data
    shopifyProduct: null,
    aiStyles: [],
    productBases: [],
    productBaseVariants: [],
    productBaseOptions: [],
    productBaseVariantOptionValues: [],
    shop: '',
    updateNeeded: false,

    // Initial state - UI state
    isDirty: false,
    isSaving: false,
    isLoading: false,
    creatingVariants: false,
    preventStateReset: false,
    actionData: null,

    // Actions
    // Product settings actions
    toggleEnabled: (checked) => set((state) => {
      state.isEnabled = checked;
      updateDirtyState(state);
    }),

    setProductData: (product) => set((state) => {
      state.product = product;
      updateDirtyState(state);
    }),

    // Style actions
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
      updateDirtyState(state);
    }),

    setSelectedStyles: (styles) => set((state) => {
      state.selectedStyles = styles;
      updateDirtyState(state);
    }),

    reorderStyles: (styleUuid, newIndex) => set((state) => {
      const oldIndex = state.selectedStyles.indexOf(styleUuid);

      if (oldIndex !== -1 && newIndex >= 0 && newIndex < state.selectedStyles.length) {
        state.selectedStyles.splice(oldIndex, 1);
        state.selectedStyles.splice(newIndex, 0, styleUuid);
      }
      updateDirtyState(state);
    }),

    // Product base actions
    toggleProductBase: (productBaseId, checked) => set((state) => {
      if (checked) {
        if (!state.selectedProductBases.includes(productBaseId)) {
          state.selectedProductBases.push(productBaseId);
        }
      } else {
        const index = state.selectedProductBases.indexOf(productBaseId);
        if (index !== -1) {
          state.selectedProductBases.splice(index, 1);
        }
      }
      
      cleanupOrphanedMappings(state);
      updateDirtyState(state);
    }),

    setSelectedProductBases: (productBases) => set((state) => {
      state.selectedProductBases = productBases;
      cleanupOrphanedMappings(state);
      updateDirtyState(state);
    }),

    // Variant mapping actions
    updateVariantMapping: (productBaseVariantId, shopifyVariantId) => set((state) => {
      // Remove existing mappings for both the product base variant and Shopify variant
      state.variantMappings = state.variantMappings.filter(
        mapping => 
          mapping.productBaseVariantId !== productBaseVariantId &&
          (shopifyVariantId ? String(mapping.shopifyVariantId) !== String(shopifyVariantId) : true)
      );

      // Add new mapping if shopifyVariantId is provided
      if (shopifyVariantId) {
        state.variantMappings.push({
          id: 0,
          productBaseVariantId,
          shopifyVariantId,
          isActive: true
        });
      }
      
      updateDirtyState(state);
    }),

    setVariantMappings: (mappings) => set((state) => {
      state.variantMappings = mappings;
      updateDirtyState(state);
    }),

    clearOrphanedMappings: (productBaseVariantIds) => set((state) => {
      const validIds = Array.isArray(productBaseVariantIds) ? productBaseVariantIds : [];
      state.variantMappings = state.variantMappings.filter(
        mapping => validIds.includes(mapping.productBaseVariantId)
      );
      updateDirtyState(state);
    }),

    // Variant price actions
    setEditingVariantPrice: (variantId, price) => set((state) => {
      if (price !== null) {
        state.editingVariantPrices[variantId] = price;
      } else {
        delete state.editingVariantPrices[variantId];
      }
    }),

    updateVariantPrice: (variantId, price) => {
      const state = get();
      state.setLoading(true);

      submitAction('update_variant_price', { variantId, newPrice: price }, state)
        .then(() => {
          state.setEditingVariantPrice(variantId, null);
        })
        .finally(() => {
          state.setLoading(false);
        });
    },

    // Variant creation/deletion actions
    createVariant: (productBaseVariantId, options) => {
      const state = get();
      state.setCreatingVariants(true);

      const variantsToCreate = [{ productBaseVariantId, options }];
      
      submitAction('create_variants', { variantsToCreate }, state)
        .finally(() => {
          state.setCreatingVariants(false);
        });
    },

    deleteVariant: (variantId) => {
      if (!confirm("Are you sure you want to delete this variant? This action cannot be undone.")) {
        return;
      }
      
      const state = get();
      state.setLoading(true);

      submitAction('delete_variant', { variantId }, state)
        .finally(() => {
          state.setLoading(false);
        });
    },

    // UI state actions
    setSaving: (isSaving) => set((state) => {
      state.isSaving = isSaving;
    }),

    setLoading: (isLoading) => set((state) => {
      state.isLoading = isLoading;
    }),

    setCreatingVariants: (isCreating) => set((state) => {
      state.creatingVariants = isCreating;
    }),

    setActionResult: (result) => set((state) => {
      state.actionData = result;
    }),

    setPreventStateReset: (prevent) => set((state) => {
      state.preventStateReset = prevent;
    }),

    // Form actions
    resetForm: () => set((state) => {
      state.product = state.originalValues.product;
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
        product: state.product,
        isEnabled: state.isEnabled,
        selectedStyles: [...state.selectedStyles],
        selectedProductBases: [...state.selectedProductBases],
        variantMappings: JSON.parse(JSON.stringify(state.variantMappings))
      };
      state.isDirty = false;
    }),

    initialize: (values) => set((state) => {
      // Set form values
      state.product = values.product;
      state.isEnabled = values.isEnabled;
      state.selectedStyles = values.selectedStyles;
      state.selectedProductBases = values.selectedProductBases;
      state.variantMappings = values.variantMappings;
      state.editingVariantPrices = {};

      // Set original values
      state.originalValues = {
        product: values.product,
        isEnabled: values.isEnabled,
        selectedStyles: [...values.selectedStyles],
        selectedProductBases: [...values.selectedProductBases],
        variantMappings: JSON.parse(JSON.stringify(values.variantMappings))
      };

      // Set reference data
      state.shopifyProduct = values.shopifyProduct;
      state.aiStyles = values.aiStyles;
      state.productBases = values.productBases;
      state.productBaseVariants = values.productBaseVariants;
      state.productBaseOptions = values.productBaseOptions;
      state.productBaseVariantOptionValues = values.productBaseVariantOptionValues;
      state.shop = values.shop;
      state.updateNeeded = values.updateNeeded;

      // Reset UI state
      state.isDirty = false;
      state.isSaving = false;
      state.isLoading = false;
      state.creatingVariants = false;
      state.actionData = null;
    }),

    /**
     * Submits the form data to the server.
     *
     * Note on state management:
     * Instead of using a timeout to reset states after form submission,
     * we use a reactive approach where the ProductDetailPage component
     * resets these states when actionData changes (indicating the submission completed).
     *
     * This is more robust because:
     * 1. It responds to the actual completion of the form submission
     * 2. It works regardless of how long the submission takes
     * 3. It handles both success and error cases consistently
     */
    submitForm: (onSubmit) => {
      const state = get();

      // Update original state with current values to prevent UI flashing during save
      state.updateOriginalState();

      // Set the preventStateReset flag to true to prevent the state from being reset during revalidation
      state.setPreventStateReset(true);

      // Set both loading and saving states to true
      state.setLoading(true);
      state.setSaving(true);

      // Create JSON data instead of FormData
      const data = {
        _action: "save_product_settings",
        isEnabled: state.isEnabled,
        selectedStyles: state.selectedStyles,
        selectedProductBases: state.selectedProductBases,
        reorderedStyles: state.selectedStyles.map((styleUuid, index) => ({
          uuid: styleUuid,
          sortOrder: index,
        })),
        variantMappings: state.variantMappings.map(mapping => ({
          productBaseVariantId: mapping.productBaseVariantId,
          shopifyVariantId: String(mapping.shopifyVariantId),
        }))
      };

      // Submit the form - states will be reset in the ProductDetailPage component when actionData changes
      onSubmit(data);
    },

    // Computed selectors
    getAvailableProductBaseVariants: () => {
      const state = get();
      
      // Get IDs of selected product bases
      const selectedProductBaseIds = state.productBases
        .filter(pb => state.selectedProductBases.includes(pb.uuid))
        .map(pb => pb.id);
      
      // Filter variants to only those belonging to selected product bases
      return state.productBaseVariants.filter(variant => 
        selectedProductBaseIds.includes(variant.productBaseId)
      );
    }
  }))
);
