import type { ReactNode} from 'react';
import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

// Utility function for deep comparison of arrays
function arraysEqual(a: any[], b: any[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  // Sort arrays if they contain primitive values
  if (a.every(item => typeof item !== 'object' || item === null)) {
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  }

  // For arrays of objects, compare each item
  return a.every((val, idx) => deepEqual(val, b[idx]));
}

// Utility function for deep comparison of objects
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return arraysEqual(a, b);
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key => keysB.includes(key) && deepEqual(a[key], b[key]));
}

// Function to check if the current state is different from the original state
function isStateDirty(current: any, original: any): boolean {
  return !deepEqual(current, original);
}

// Define types for product data
interface Product {
  id: number;
  uuid: string;
  title: string;
  shopifyProductId: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ShopifyVariant {
  id: string;
  title: string;
  sku: string;
  price: string;
  compareAtPrice?: string;
  availableForSale: boolean;
  inventoryQuantity: number;
  position: number;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
  image?: {
    id: string;
    url: string;
    altText?: string;
  };
}

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  variants: {
    edges: Array<{
      node: ShopifyVariant;
    }>;
  };
  images: {
    edges: Array<{
      node: {
        id: string;
        url: string;
        altText?: string;
      };
    }>;
  };
}

interface AiStyle {
  id: number;
  uuid: string;
  name: string;
  exampleImageUrl?: string;
  isActive: boolean;
}

interface ProductBaseVariant {
  id: number;
  uuid: string;
  productBaseId: number;
  name: string;
  widthPx: number;
  heightPx: number;
  priceModifier: number;
  isActive: boolean;
  sortOrder: number;
  productBase?: {
    id: number;
    uuid: string;
    name: string;
  };
}

interface ProductBaseOption {
  id: number;
  productBaseId: number;
  name: string;
  sortOrder: number;
}

interface ProductBaseVariantOptionValue {
  id: number;
  productBaseVariantId: number;
  productBaseOptionId: number;
  value: string;
}

// Interface for variant mappings
interface VariantMapping {
  id: number;
  productBaseVariantId: number;
  shopifyVariantId: string;
  isActive: boolean;
  productBaseVariant?: {
    id: number;
    uuid: string;
    name: string;
  };
}

// Define types for our state
interface ProductFormState {
  // Original values from loader (for dirty state comparison and reset)
  original: {
    product: Product;
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
  };

  // Current form values
  current: {
    product: Product;
    isEnabled: boolean;
    selectedStyles: string[];
    selectedProductBases: string[];
    variantMappings: VariantMapping[];
    editingVariantPrices: Record<string, string>;
  };

  // Data from loader (not part of form state, but needed for rendering)
  data: {
    shopifyProduct: ShopifyProduct | null;
    aiStyles: AiStyle[];
    productBases: any[]; // Using any for now, will define proper type later
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
    preventStateReset: boolean; // Flag to prevent state reset during save
    actionData: {
      error?: string;
      success?: boolean;
      message?: string;
    } | null;
  };
}

// Define action types
type ProductFormAction =
  // Product settings actions
  | { type: 'TOGGLE_ENABLED'; payload: boolean }
  | { type: 'SET_PRODUCT_DATA'; payload: Product }

  // Style actions
  | { type: 'SET_SELECTED_STYLES'; payload: string[] }
  | { type: 'TOGGLE_STYLE'; payload: { styleId: string; checked: boolean } }
  | { type: 'REORDER_STYLES'; payload: { styleUuid: string; newIndex: number } }

  // Product base actions
  | { type: 'SET_SELECTED_PRODUCT_BASES'; payload: string[] }
  | { type: 'TOGGLE_PRODUCT_BASE'; payload: { productBaseId: string; checked: boolean } }

  // Variant mapping actions
  | { type: 'SET_VARIANT_MAPPINGS'; payload: VariantMapping[] }
  | { type: 'UPDATE_VARIANT_MAPPING'; payload: { productBaseVariantId: number; shopifyVariantId: string | null } }
  | { type: 'CLEAR_ORPHANED_MAPPINGS'; payload: { productBaseVariantIds: number[] } }

  // Variant price actions
  | { type: 'SET_EDITING_VARIANT_PRICE'; payload: { variantId: string; price: string | null } }
  | { type: 'UPDATE_VARIANT_PRICE'; payload: { variantId: string; price: string } }

  // Variant creation/deletion actions
  | { type: 'CREATE_VARIANT'; payload: { productBaseVariantId: number; options: Array<{ name: string; value: string }> } }
  | { type: 'DELETE_VARIANT'; payload: { variantId: string } }

  // UI state actions
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CREATING_VARIANTS'; payload: boolean }
  | { type: 'SET_ACTION_RESULT'; payload: { success?: boolean; error?: string; message?: string } | null }
  | { type: 'SET_PREVENT_STATE_RESET'; payload: boolean }

  // Form actions
  | { type: 'RESET_FORM' }
  | { type: 'UPDATE_ORIGINAL_STATE' } // Add this action to update original state with current values
  | { type: 'INITIALIZE'; payload: {
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
    } };

// Create a reducer function to handle state updates
function productFormReducer(state: ProductFormState, action: ProductFormAction): ProductFormState {
  switch (action.type) {
    // Product settings actions
    case 'TOGGLE_ENABLED': {
      const newState = {
        ...state,
        current: {
          ...state.current,
          isEnabled: action.payload
        }
      };

      // Calculate if the state is dirty by comparing current with original
      const isDirty = isStateDirty(newState.current.isEnabled, state.original.isEnabled) ||
                      isStateDirty(newState.current.selectedStyles, state.original.selectedStyles) ||
                      isStateDirty(newState.current.selectedProductBases, state.original.selectedProductBases) ||
                      isStateDirty(newState.current.variantMappings, state.original.variantMappings);

      return {
        ...newState,
        ui: {
          ...state.ui,
          isDirty
        }
      };
    }

    case 'SET_PRODUCT_DATA':
      return {
        ...state,
        current: {
          ...state.current,
          product: action.payload
        },
        ui: {
          ...state.ui,
          isDirty: true
        }
      };

    // Style actions
    case 'SET_SELECTED_STYLES': {
      const newState = {
        ...state,
        current: {
          ...state.current,
          selectedStyles: action.payload
        }
      };

      // Calculate if the state is dirty by comparing current with original
      const isDirty = isStateDirty(newState.current.isEnabled, state.original.isEnabled) ||
                      isStateDirty(newState.current.selectedStyles, state.original.selectedStyles) ||
                      isStateDirty(newState.current.selectedProductBases, state.original.selectedProductBases) ||
                      isStateDirty(newState.current.variantMappings, state.original.variantMappings);

      return {
        ...newState,
        ui: {
          ...state.ui,
          isDirty
        }
      };
    }

    case 'TOGGLE_STYLE': {
      const { styleId, checked } = action.payload;
      const currentStyles = [...state.current.selectedStyles];

      if (checked) {
        // Only add if not already in the array
        if (!currentStyles.includes(styleId)) {
          currentStyles.push(styleId);
        }
      } else {
        const index = currentStyles.indexOf(styleId);
        if (index !== -1) {
          currentStyles.splice(index, 1);
        }
      }

      const newState = {
        ...state,
        current: {
          ...state.current,
          selectedStyles: currentStyles
        }
      };

      // Calculate if the state is dirty by comparing current with original
      const isDirty = isStateDirty(newState.current.isEnabled, state.original.isEnabled) ||
                      isStateDirty(newState.current.selectedStyles, state.original.selectedStyles) ||
                      isStateDirty(newState.current.selectedProductBases, state.original.selectedProductBases) ||
                      isStateDirty(newState.current.variantMappings, state.original.variantMappings);

      return {
        ...newState,
        ui: {
          ...state.ui,
          isDirty
        }
      };
    }

    case 'REORDER_STYLES': {
      const { styleUuid, newIndex } = action.payload;
      const currentStyles = [...state.current.selectedStyles];
      const oldIndex = currentStyles.indexOf(styleUuid);

      if (oldIndex !== -1 && newIndex >= 0 && newIndex < currentStyles.length) {
        // Remove the style from its current position
        currentStyles.splice(oldIndex, 1);
        // Insert it at the new position
        currentStyles.splice(newIndex, 0, styleUuid);
      }

      return {
        ...state,
        current: {
          ...state.current,
          selectedStyles: currentStyles
        },
        ui: {
          ...state.ui,
          isDirty: true
        }
      };
    }

    // Product base actions
    case 'SET_SELECTED_PRODUCT_BASES': {
      const newProductBases = action.payload;

      return {
        ...state,
        current: {
          ...state.current,
          selectedProductBases: newProductBases
        },
        ui: {
          ...state.ui,
          isDirty: true
        }
      };
    }

    case 'TOGGLE_PRODUCT_BASE': {
      const { productBaseId, checked } = action.payload;
      const currentProductBases = [...state.current.selectedProductBases];

      if (checked) {
        // Only add if not already in the array
        if (!currentProductBases.includes(productBaseId)) {
          currentProductBases.push(productBaseId);
        }
      } else {
        const index = currentProductBases.indexOf(productBaseId);
        if (index !== -1) {
          currentProductBases.splice(index, 1);
        }
      }

      const newState = {
        ...state,
        current: {
          ...state.current,
          selectedProductBases: currentProductBases
        }
      };

      // Calculate if the state is dirty by comparing current with original
      const isDirty = isStateDirty(newState.current.isEnabled, state.original.isEnabled) ||
                      isStateDirty(newState.current.selectedStyles, state.original.selectedStyles) ||
                      isStateDirty(newState.current.selectedProductBases, state.original.selectedProductBases) ||
                      isStateDirty(newState.current.variantMappings, state.original.variantMappings);

      return {
        ...newState,
        ui: {
          ...state.ui,
          isDirty
        }
      };
    }

    // Variant mapping actions
    case 'SET_VARIANT_MAPPINGS': {
      const newState = {
        ...state,
        current: {
          ...state.current,
          variantMappings: action.payload
        }
      };

      // Calculate if the state is dirty by comparing current with original
      const isDirty = isStateDirty(newState.current.isEnabled, state.original.isEnabled) ||
                      isStateDirty(newState.current.selectedStyles, state.original.selectedStyles) ||
                      isStateDirty(newState.current.selectedProductBases, state.original.selectedProductBases) ||
                      isStateDirty(newState.current.variantMappings, state.original.variantMappings);

      return {
        ...newState,
        ui: {
          ...state.ui,
          isDirty
        }
      };
    }

    case 'UPDATE_VARIANT_MAPPING': {
      const { productBaseVariantId, shopifyVariantId } = action.payload;
      const currentMappings = [...state.current.variantMappings];

      // Remove any existing mapping for this product base variant
      const existingMappingIndex = currentMappings.findIndex(
        mapping => mapping.productBaseVariantId === productBaseVariantId
      );

      if (existingMappingIndex !== -1) {
        currentMappings.splice(existingMappingIndex, 1);
      }

      // Remove any existing mapping for this Shopify variant
      if (shopifyVariantId) {
        const duplicateIndex = currentMappings.findIndex(
          mapping => String(mapping.shopifyVariantId) === String(shopifyVariantId)
        );

        if (duplicateIndex !== -1) {
          currentMappings.splice(duplicateIndex, 1);
        }
      }

      // Add new mapping if shopifyVariantId is provided
      if (shopifyVariantId) {
        currentMappings.push({
          id: 0, // This will be assigned by the server
          productBaseVariantId,
          shopifyVariantId,
          isActive: true
        });
      }

      const newState = {
        ...state,
        current: {
          ...state.current,
          variantMappings: currentMappings
        }
      };

      // Calculate if the state is dirty by comparing current with original
      const isDirty = isStateDirty(newState.current.isEnabled, state.original.isEnabled) ||
                      isStateDirty(newState.current.selectedStyles, state.original.selectedStyles) ||
                      isStateDirty(newState.current.selectedProductBases, state.original.selectedProductBases) ||
                      isStateDirty(newState.current.variantMappings, state.original.variantMappings);

      return {
        ...newState,
        ui: {
          ...state.ui,
          isDirty
        }
      };
    }

    case 'CLEAR_ORPHANED_MAPPINGS': {
      const { productBaseVariantIds } = action.payload;
      const currentMappings = [...state.current.variantMappings];

      // Keep only mappings for product base variants that are still selected
      const filteredMappings = currentMappings.filter(
        mapping => productBaseVariantIds.includes(mapping.productBaseVariantId)
      );

      const newState = {
        ...state,
        current: {
          ...state.current,
          variantMappings: filteredMappings
        }
      };

      // Calculate if the state is dirty by comparing current with original
      const isDirty = isStateDirty(newState.current.isEnabled, state.original.isEnabled) ||
                      isStateDirty(newState.current.selectedStyles, state.original.selectedStyles) ||
                      isStateDirty(newState.current.selectedProductBases, state.original.selectedProductBases) ||
                      isStateDirty(newState.current.variantMappings, state.original.variantMappings);

      return {
        ...newState,
        ui: {
          ...state.ui,
          isDirty
        }
      };
    }

    // Variant price actions
    case 'SET_EDITING_VARIANT_PRICE': {
      const { variantId, price } = action.payload;
      const newEditingPrices = { ...state.current.editingVariantPrices };

      if (price !== null) {
        newEditingPrices[variantId] = price;
      } else {
        delete newEditingPrices[variantId];
      }

      return {
        ...state,
        current: {
          ...state.current,
          editingVariantPrices: newEditingPrices
        }
      };
    }

    case 'UPDATE_VARIANT_PRICE': {
      // This action doesn't update the state directly
      // It will be handled by the action function
      // We just mark the form as dirty
      return {
        ...state,
        ui: {
          ...state.ui,
          isDirty: true
        }
      };
    }

    // Variant creation/deletion actions
    case 'CREATE_VARIANT':
    case 'DELETE_VARIANT':
      // These actions don't update the state directly
      // They will be handled by the action function
      // We just mark the form as dirty
      return {
        ...state,
        ui: {
          ...state.ui,
          isDirty: true
        }
      };

    // UI state actions
    case 'SET_SAVING':
      return {
        ...state,
        ui: {
          ...state.ui,
          isSaving: action.payload
        }
      };

    case 'SET_LOADING':
      return {
        ...state,
        ui: {
          ...state.ui,
          isLoading: action.payload
        }
      };

    case 'SET_CREATING_VARIANTS':
      return {
        ...state,
        ui: {
          ...state.ui,
          creatingVariants: action.payload
        }
      };

    case 'SET_ACTION_RESULT':
      return {
        ...state,
        ui: {
          ...state.ui,
          actionData: action.payload
        }
      };

    case 'SET_PREVENT_STATE_RESET':
      return {
        ...state,
        ui: {
          ...state.ui,
          preventStateReset: action.payload
        }
      };

    // Form actions
    case 'UPDATE_ORIGINAL_STATE':
      return {
        ...state,
        original: {
          product: state.current.product,
          isEnabled: state.current.isEnabled,
          selectedStyles: state.current.selectedStyles,
          selectedProductBases: state.current.selectedProductBases,
          variantMappings: state.current.variantMappings,
        },
        ui: {
          ...state.ui,
          isDirty: false // Reset dirty state since original now matches current
        }
      };

    case 'RESET_FORM':
      return {
        ...state,
        current: {
          ...state.original,
          editingVariantPrices: {}
        },
        ui: {
          ...state.ui,
          isDirty: false,
          actionData: null
        }
      };

    case 'INITIALIZE':
      return {
        original: {
          product: action.payload.product,
          isEnabled: action.payload.isEnabled,
          selectedStyles: action.payload.selectedStyles,
          selectedProductBases: action.payload.selectedProductBases,
          variantMappings: action.payload.variantMappings,
        },
        current: {
          product: action.payload.product,
          isEnabled: action.payload.isEnabled,
          selectedStyles: action.payload.selectedStyles,
          selectedProductBases: action.payload.selectedProductBases,
          variantMappings: action.payload.variantMappings,
          editingVariantPrices: {}
        },
        data: {
          shopifyProduct: action.payload.shopifyProduct,
          aiStyles: action.payload.aiStyles,
          productBases: action.payload.productBases,
          productBaseVariants: action.payload.productBaseVariants,
          productBaseOptions: action.payload.productBaseOptions,
          productBaseVariantOptionValues: action.payload.productBaseVariantOptionValues,
          shop: action.payload.shop,
          updateNeeded: action.payload.updateNeeded,
        },
        ui: {
          isDirty: false,
          isSaving: false,
          isLoading: false,
          creatingVariants: false,
          actionData: null
        }
      };

    default:
      return state;
  }
}

// Create a context with default values
interface ProductFormContextType {
  state: ProductFormState;
  dispatch: React.Dispatch<ProductFormAction>;

  // Product settings helpers
  toggleEnabled: (checked: boolean) => void;
  setProductData: (product: Product) => void;

  // Style helpers
  toggleStyle: (styleId: string, checked: boolean) => void;
  setSelectedStyles: (styles: string[]) => void;
  reorderStyles: (styleUuid: string, newIndex: number) => void;

  // Product base helpers
  toggleProductBase: (productBaseId: string, checked: boolean) => void;
  setSelectedProductBases: (productBases: string[]) => void;

  // Variant mapping helpers
  updateVariantMapping: (productBaseVariantId: number, shopifyVariantId: string | null) => void;
  setVariantMappings: (mappings: VariantMapping[]) => void;
  clearOrphanedMappings: (productBaseVariantIds: number[]) => void;

  // Variant price helpers
  setEditingVariantPrice: (variantId: string, price: string | null) => void;
  updateVariantPrice: (variantId: string, price: string) => void;

  // Variant creation/deletion helpers
  createVariant: (productBaseVariantId: number, options: Array<{ name: string; value: string }>) => void;
  deleteVariant: (variantId: string) => void;

  // UI state helpers
  setSaving: (isSaving: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setCreatingVariants: (isCreating: boolean) => void;
  setActionResult: (result: { success?: boolean; error?: string; message?: string } | null) => void;
  setPreventStateReset: (prevent: boolean) => void;

  // Form helpers
  resetForm: () => void;

  // Submission helpers
  submitForm: () => void;

  // Computed values
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  creatingVariants: boolean;
  hasError: boolean;
  errorMessage: string | undefined;
  successMessage: string | undefined;
}

// Initial state for the reducer
const initialState: ProductFormState = {
  original: {
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
  current: {
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
    editingVariantPrices: {}
  },
  data: {
    shopifyProduct: null,
    aiStyles: [],
    productBases: [],
    productBaseVariants: [],
    productBaseOptions: [],
    productBaseVariantOptionValues: [],
    shop: '',
    updateNeeded: false
  },
  ui: {
    isDirty: false,
    isSaving: false,
    isLoading: false,
    creatingVariants: false,
    preventStateReset: false,
    actionData: null
  }
};

const ProductFormContext = createContext<ProductFormContextType | undefined>(undefined);

// Create a provider component
interface ProductFormProviderProps {
  children: ReactNode;
  initialValues: {
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
  };
  onSubmit?: (formData: FormData) => void;
}

export function ProductFormProvider({ children, initialValues, onSubmit }: ProductFormProviderProps) {
  const [state, dispatch] = useReducer(productFormReducer, initialState);

  // Initialize the form with initial values
  useEffect(() => {
    // Only initialize if we're not in the middle of a save operation
    // This prevents the state from being reset during revalidation
    if (!state.ui.preventStateReset) {
      dispatch({ type: 'INITIALIZE', payload: initialValues });
    }
  }, [initialValues, state.ui.preventStateReset]);

  // Product settings helpers
  const toggleEnabled = useCallback((checked: boolean) => {
    dispatch({ type: 'TOGGLE_ENABLED', payload: checked });
  }, []);

  const setProductData = useCallback((product: Product) => {
    dispatch({ type: 'SET_PRODUCT_DATA', payload: product });
  }, []);

  // Style helpers
  const toggleStyle = useCallback((styleId: string, checked: boolean) => {
    dispatch({ type: 'TOGGLE_STYLE', payload: { styleId, checked } });
  }, []);

  const setSelectedStyles = useCallback((styles: string[]) => {
    dispatch({ type: 'SET_SELECTED_STYLES', payload: styles });
  }, []);

  const reorderStyles = useCallback((styleUuid: string, newIndex: number) => {
    dispatch({ type: 'REORDER_STYLES', payload: { styleUuid, newIndex } });
  }, []);

  // Product base helpers
  const toggleProductBase = useCallback((productBaseId: string, checked: boolean) => {
    dispatch({ type: 'TOGGLE_PRODUCT_BASE', payload: { productBaseId, checked } });
  }, []);

  const setSelectedProductBases = useCallback((productBases: string[]) => {
    dispatch({ type: 'SET_SELECTED_PRODUCT_BASES', payload: productBases });
  }, []);

  // Variant mapping helpers
  const updateVariantMapping = useCallback((productBaseVariantId: number, shopifyVariantId: string | null) => {
    dispatch({ type: 'UPDATE_VARIANT_MAPPING', payload: { productBaseVariantId, shopifyVariantId } });
  }, []);

  const setVariantMappings = useCallback((mappings: VariantMapping[]) => {
    dispatch({ type: 'SET_VARIANT_MAPPINGS', payload: mappings });
  }, []);

  const clearOrphanedMappings = useCallback((productBaseVariantIds: number[]) => {
    dispatch({ type: 'CLEAR_ORPHANED_MAPPINGS', payload: { productBaseVariantIds } });
  }, []);

  // Variant price helpers
  const setEditingVariantPrice = useCallback((variantId: string, price: string | null) => {
    dispatch({ type: 'SET_EDITING_VARIANT_PRICE', payload: { variantId, price } });
  }, []);

  const updateVariantPrice = useCallback((variantId: string, price: string) => {
    dispatch({ type: 'UPDATE_VARIANT_PRICE', payload: { variantId, price } });
  }, []);

  // Variant creation/deletion helpers
  const createVariant = useCallback((productBaseVariantId: number, options: Array<{ name: string; value: string }>) => {
    dispatch({ type: 'CREATE_VARIANT', payload: { productBaseVariantId, options } });
  }, []);

  const deleteVariant = useCallback((variantId: string) => {
    dispatch({ type: 'DELETE_VARIANT', payload: { variantId } });
  }, []);

  // UI state helpers
  const setSaving = useCallback((isSaving: boolean) => {
    dispatch({ type: 'SET_SAVING', payload: isSaving });
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: isLoading });
  }, []);

  const setCreatingVariants = useCallback((isCreating: boolean) => {
    dispatch({ type: 'SET_CREATING_VARIANTS', payload: isCreating });
  }, []);

  const setActionResult = useCallback((result: { success?: boolean; error?: string; message?: string } | null) => {
    dispatch({ type: 'SET_ACTION_RESULT', payload: result });
  }, []);

  const setPreventStateReset = useCallback((prevent: boolean) => {
    dispatch({ type: 'SET_PREVENT_STATE_RESET', payload: prevent });
  }, []);

  // Form helpers
  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM' });
  }, []);

  // Submission helper - Consolidated to include all form data in a single save action
  const submitForm = useCallback(() => {
    if (!onSubmit) return;

    // Update original state with current values to prevent UI flashing during save
    dispatch({ type: 'UPDATE_ORIGINAL_STATE' });

    // Set the preventStateReset flag to true to prevent the state from being reset during revalidation
    setPreventStateReset(true);

    setSaving(true);

    const formData = new FormData();
    formData.append("action", "save_product_settings");
    formData.append("isEnabled", state.current.isEnabled.toString());
    formData.append("selectedStyles", JSON.stringify(state.current.selectedStyles));
    formData.append("selectedProductBases", JSON.stringify(state.current.selectedProductBases));

    // Include reordered styles data with sort order
    const reorderedStyles = state.current.selectedStyles.map((styleUuid, index) => ({
      uuid: styleUuid,
      sortOrder: index,
    }));
    formData.append("reorderedStyles", JSON.stringify(reorderedStyles));

    // Include variant mappings in the main save action
    // This eliminates the need for a separate "Save All Mappings" button
    // and ensures all changes are saved together
    const mappings = state.current.variantMappings.map(mapping => ({
      productBaseVariantId: mapping.productBaseVariantId,
      shopifyVariantId: mapping.shopifyVariantId,
    }));
    formData.append("variantMappings", JSON.stringify(mappings));

    onSubmit(formData);

    // Reset the preventStateReset flag after a delay to allow for revalidation to complete
    // This ensures that future initializations will work correctly
    setTimeout(() => {
      setPreventStateReset(false);
    }, 2000); // 2 seconds should be enough for revalidation to complete
  }, [onSubmit, setSaving, state, dispatch, setPreventStateReset]);

  // No longer need to create a Field-compatible interface for AiStyleSelection component

  // Computed values
  const isDirty = state.ui.isDirty;
  const isLoading = state.ui.isLoading;
  const isSaving = state.ui.isSaving;
  const creatingVariants = state.ui.creatingVariants;
  const hasError = !!state.ui.actionData?.error;
  const errorMessage = state.ui.actionData?.error;
  const successMessage = state.ui.actionData?.message;

  const value = {
    state,
    dispatch,
    toggleEnabled,
    setProductData,
    toggleStyle,
    setSelectedStyles,
    reorderStyles,
    toggleProductBase,
    setSelectedProductBases,
    updateVariantMapping,
    setVariantMappings,
    clearOrphanedMappings,
    setEditingVariantPrice,
    updateVariantPrice,
    createVariant,
    deleteVariant,
    setSaving,
    setLoading,
    setCreatingVariants,
    setActionResult,
    setPreventStateReset,
    resetForm,
    submitForm,
    isDirty,
    isLoading,
    isSaving,
    creatingVariants,
    hasError,
    errorMessage,
    successMessage
  };

  return (
    <ProductFormContext.Provider value={value}>
      {children}
    </ProductFormContext.Provider>
  );
}

// Create a custom hook to use the context
export function useProductForm() {
  const context = useContext(ProductFormContext);

  if (context === undefined) {
    throw new Error('useProductForm must be used within a ProductFormProvider');
  }

  return context;
}
