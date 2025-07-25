// Type definitions for the product form

// Product data types
export interface Product {
  id: number;
  uuid: string;
  title: string;
  shopifyProductId: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyVariant {
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

export interface ShopifyProduct {
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

export interface AiStyle {
  id: number;
  uuid: string;
  name: string;
  exampleImageUrl?: string;
  isActive: boolean;
}

export interface ProductBaseVariant {
  id: number;
  uuid: string;
  productBaseId: number;
  name: string;
  widthPx: number;
  heightPx: number;
  price: number;
  compareAtPrice?: number;
  isActive: boolean;
  sortOrder: number;
  productBase?: {
    id: number;
    uuid: string;
    name: string;
  };
}

export interface ProductBaseOption {
  id: number;
  productBaseId: number;
  name: string;
  sortOrder: number;
}

export interface ProductBaseVariantOptionValue {
  id: number;
  productBaseVariantId: number;
  productBaseOptionId: number;
  value: string;
}

// Interface for variant mappings
export interface VariantMapping {
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

// Form state types
export interface ProductFormState {
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

// Action types
export type ProductFormAction =
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
  | { type: 'SET_DIRTY_STATE'; payload: boolean }

  // Form actions
  | { type: 'RESET_FORM' }
  | { type: 'UPDATE_ORIGINAL_STATE' }
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

// Context type
export interface ProductFormContextType {
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

// Provider props
export interface ProductFormProviderProps {
  children: React.ReactNode;
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

export interface ProductBase {
  id: number;
  uuid: string;
  shopId: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}