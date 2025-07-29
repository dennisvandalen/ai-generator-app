# Variant Sync System Documentation

## Overview

The Variant Sync System is a comprehensive solution for synchronizing product variants between our local database (product base variants) and Shopify. It ensures that Shopify products have the correct variants with accurate pricing, options, and mappings while maintaining data consistency across both systems.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Sync Workflow](#sync-workflow)
3. [Key Components](#key-components)
4. [Data Flow](#data-flow)
5. [GraphQL Operations](#graphql-operations)
6. [Error Handling](#error-handling)
7. [UI Integration](#ui-integration)
8. [Troubleshooting](#troubleshooting)
9. [Future Improvements](#future-improvements)

## System Architecture

### Core Principle
The sync system follows a **one-way sync** approach from our local database → Shopify, treating our local product base variants as the source of truth.

### Database Schema
- **`productBaseVariantsTable`**: Local variants with pricing and option values
- **`productBaseVariantMappingsTable`**: Links local variants to Shopify variant IDs
- **`productBaseOptionsTable`**: Defines option types (Size, Color, etc.)

### Key Files
- **`app/routes/app.products.$id_.rhf.tsx`**: Main sync logic and UI integration
- **`app/components/ProductDetailForm.tsx`**: Sync button and variant display UI
- **`sync_plan.md`**: Original pseudocode blueprint for the sync algorithm

## Sync Workflow

### 1. Detection Phase (Loader)
```typescript
// Price mismatch detection in loader
const variantsNeedingPriceSync = cleanedVariantMappings.filter(mapping => {
  const localVariant = productBaseVariantMap.get(mapping.productBaseVariantId);
  const shopifyVariant = shopifyProduct.variants.find(v => 
    parseInt(extractShopifyId(v.id)) === mapping.shopifyVariantId
  );
  
  if (localVariant && shopifyVariant) {
    const priceNeedsUpdate = parseFloat(shopifyVariant.price) !== parseFloat(localVariant.price);
    const compareAtPriceNeedsUpdate = 
      (localVariant.compareAtPrice != null) !== (shopifyVariant.compareAtPrice != null) ||
      (localVariant.compareAtPrice != null && shopifyVariant.compareAtPrice != null &&
       parseFloat(shopifyVariant.compareAtPrice) !== parseFloat(localVariant.compareAtPrice));
    
    return priceNeedsUpdate || compareAtPriceNeedsUpdate;
  }
  return false;
}).length;
```

### 2. Option Management
```typescript
// Ensure required options exist on Shopify product
await ensureShopifyOptions(productId, requiredOptions);

// Handle three scenarios:
// 1. Product has default "Title" option only → Replace with custom options
// 2. Product has custom options → Add missing values to existing options  
// 3. Product already has all required options → Skip
```

### 3. Variant Analysis
```typescript
// Build mutation batches
const toCreate = [];    // Missing variants
const toUpdate = [];    // Price/compareAtPrice mismatches
const toDelete = [];    // Orphaned Shopify variants (if removeOrphaned enabled)

// Key-based comparison using normalized option values
const createLocalVariantKey = (variant) => 
  Object.entries(variant.optionValues)
    .map(([name, value]) => `${name}:${value}`)
    .sort()
    .join('/');
```

### 4. Bulk Operations
```typescript
// Execute GraphQL mutations in sequence
if (toCreate.length > 0) {
  await productVariantsBulkCreate(productId, toCreate);
}

if (toUpdate.length > 0) {
  await productVariantsBulkUpdate(productId, toUpdate);
}

if (toDelete.length > 0) {
  await productVariantsBulkDelete(productId, toDelete);
}
```

### 5. Mapping Updates
```typescript
// Update local database mappings for newly created variants
// Clean up mappings for deleted variants
// Use fuzzy matching to handle option value ordering differences
```

## Key Components

### SyncVariantsButton Component
**File**: `app/components/ProductDetailForm.tsx`

**Purpose**: Provides UI for initiating sync operations with visual feedback

**Features**:
- Dynamic button text showing counts: "Sync Variants (3 missing, 2 price updates)"
- Modal with sync options (create missing, update existing, remove orphaned)
- Loading states and success/error feedback
- Integrates with React Hook Form for form state management

```typescript
interface SyncVariantsButtonProps {
  onSyncVariants: (options: SyncOptions) => void;
  creatingVariants: boolean;
  missingCount: number;
  unmappedCount: number;
  syncStatus: {
    variantsNeedingPriceSync: number;
  };
}
```

### Sync Action Handler
**File**: `app/routes/app.products.$id_.rhf.tsx` (syncVariants action)

**Purpose**: Orchestrates the complete sync workflow

**Input Schema**:
```typescript
const SyncVariantsSchema = z.object({
  createMissing: z.boolean().default(true),
  updateExisting: z.boolean().default(true),
  removeOrphaned: z.boolean().default(false),
});
```

### GraphQL Helper Functions

#### `fetchShopifyProductVariants`
Retrieves current Shopify variants with pricing and option data.

#### `fetchShopifyProductOptions`
Gets existing product options and their values.

#### `ensureShopifyOptions`
Creates or updates product options as needed, with sophisticated error handling for "already exists" scenarios.

## Data Flow

### 1. Page Load
```
Loader → Fetch local variants → Fetch Shopify variants → Calculate sync status → Render UI
```

### 2. User Initiates Sync
```
UI Button → Form Submission → Action Handler → GraphQL Operations → Database Updates → UI Refresh
```

### 3. Sync Execution Flow
```
ensureShopifyOptions → fetchShopifyProductVariants → analyzeVariantDifferences → 
executeBulkMutations → updateLocalMappings → returnResults
```

## GraphQL Operations

### Product Options Management

#### Create Options (New Product)
```graphql
mutation ProductOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
  productOptionsCreate(productId: $productId, options: $options) {
    product { id }
    userErrors { field message }
  }
}
```

#### Update Options (Add Values)
```graphql
mutation ProductOptionUpdate($productId: ID!, $option: OptionUpdateInput!) {
  productOptionUpdate(productId: $productId, option: $option) {
    product { id }
    userErrors { field message }
  }
}
```

### Variant Bulk Operations

#### Create Variants
```graphql
mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants) {
    product { id }
    productVariants {
      id
      selectedOptions { name value }
    }
    userErrors { field message }
  }
}
```

#### Update Variants
```graphql
mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    product { id }
    productVariants {
      id
      price
      compareAtPrice
    }
    userErrors { field message }
  }
}
```

#### Delete Variants
```graphql
mutation ProductVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
  productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
    product { id }
    userErrors { field message }
  }
}
```

## Error Handling

### Option Management Errors

#### "Option already exists"
```typescript
// Handle when trying to create an option that exists
if (error.message.includes("already exists")) {
  // Switch to adding values to existing option instead
  return await addValuesToExistingOption(optionName, missingValues);
}
```

#### "Option value already exists"
```typescript
// Handle case-sensitivity and whitespace issues
const missingValues = requiredValues.filter(value => 
  !existingValues.some(existing => 
    existing.toLowerCase().trim() === value.toLowerCase().trim()
  )
);

// Graceful fallback with warning
try {
  await productOptionUpdate({ optionValuesToAdd: missingValues });
} catch (error) {
  if (error.message.includes("Option value already exists")) {
    console.warn(`Option value already exists, continuing sync...`);
    continue;
  }
  throw error;
}
```

### Variant Creation Errors

#### "Variant already exists"
```typescript
// Handle when bulk create includes duplicate variants
// Filter successful creates and update mappings accordingly
const successfulCreates = result.productVariants || [];
```

#### "Need to add option values"
```typescript
// Ensure options are created before variants
await ensureShopifyOptions(productId, requiredOptions);
// Then retry variant creation
```

### Mapping Consistency

#### Invalid Mappings Cleanup
```typescript
// Loader automatically cleans up orphaned mappings
const validShopifyVariantIds = new Set(
  shopifyProduct.variants.map(v => parseInt(extractShopifyId(v.id)))
);

const invalidMappings = variantMappings.filter(mapping => 
  !validShopifyVariantIds.has(mapping.shopifyVariantId)
);

if (invalidMappings.length > 0) {
  await drizzleDb.delete(productBaseVariantMappingsTable)
    .where(inArray(productBaseVariantMappingsTable.id, invalidMappings.map(m => m.id)));
}
```

## UI Integration

### Real-time Sync Status
The UI automatically detects when sync is needed by comparing:
- Missing local variants not yet created on Shopify
- Unmapped Shopify variants not linked to local variants  
- Price mismatches between local and Shopify variants
- CompareAtPrice mismatches (including null vs value)

### Button States
```typescript
const getButtonText = () => {
  const parts = [];
  if (missingCount > 0) parts.push(`${missingCount} missing`);
  if (unmappedCount > 0) parts.push(`${unmappedCount} unmapped`);
  if (syncStatus.variantsNeedingPriceSync > 0) parts.push(`${syncStatus.variantsNeedingPriceSync} price updates`);
  
  return parts.length > 0 
    ? `Sync Variants (${parts.join(', ')})` 
    : 'Sync Variants';
};

const tone = missingCount > 0 || unmappedCount > 0 || syncStatus.variantsNeedingPriceSync > 0 
  ? 'success' 
  : undefined;
```

### Form Integration
```typescript
// React Hook Form integration
const form = useForm<ProductFormData>({
  resolver: zodResolver(ProductFormSchema),
  defaultValues: productFormData,
});

// Update form when sync completes
useEffect(() => {
  if (variantMappings && variantMappings.length > 0) {
    form.setValue('variantMappings', variantMappings, { shouldDirty: false });
  }
}, [variantMappings, form]);
```

### Auto-refresh After Sync
```typescript
// Differentiate between sync operations and regular saves
const isSyncOperation = fetcherData.message?.includes('Variant sync completed');

if (isSyncOperation) {
  revalidator.revalidate(); // Refresh data
} else {
  form.reset(form.getValues()); // Clear dirty state
}
```

## Troubleshooting

### Common Issues

#### 1. Price Updates Not Detected
**Symptoms**: UI shows sync needed but no variants are updated
**Cause**: Sync logic differs from loader detection logic
**Solution**: Ensure both use identical comparison logic

#### 2. CompareAtPrice Not Unset
**Symptoms**: Shopify retains old compareAtPrice values
**Cause**: Not explicitly passing `null` to unset values
**Solution**: Always pass `compareAtPrice: localVariant.compareAtPrice || null`

#### 3. Infinite Sync Loop
**Symptoms**: Sync completes but immediately shows as needed again
**Cause**: Data type mismatches in price comparison
**Solution**: Ensure consistent parsing: `parseFloat(stringValue)`

#### 4. Mapping Mismatch After Sync
**Symptoms**: New variants created but not mapped locally
**Cause**: Option value ordering differences between local and Shopify
**Solution**: Use fuzzy matching in mapping updates

### Debug Logging

Enable detailed logging by checking console output:

```typescript
// Sync analysis logging
console.log('📊 Sync Analysis:', {
  variantsToCreate,
  variantsNeedingPriceUpdate, 
  variantsToDelete
});

// Price comparison logging  
console.log('=== PRICE SYNC DEBUG ===');
console.log('Local price:', localPrice, typeof localPrice);
console.log('Shopify price:', shopifyPrice, typeof shopifyPrice);
```

### Manual Recovery

#### Reset Mappings
```sql
DELETE FROM productBaseVariantMappings WHERE productId = ?;
```

#### Force Recreate All Variants
1. Set `removeOrphaned: true` 
2. Run sync to delete all Shopify variants
3. Run sync again to recreate from local variants

## Future Improvements

### Performance Optimizations
- Implement batch processing for large product catalogs
- Add progress indicators for long-running sync operations
- Cache Shopify data to reduce API calls

### Enhanced Error Recovery
- Retry mechanisms for transient API failures
- Partial sync recovery (continue after individual failures)
- Conflict resolution strategies for concurrent modifications

### Advanced Features
- Bidirectional sync (Shopify → Local) for price updates
- Scheduled sync operations
- Audit trail for sync operations
- Bulk sync across multiple products

### UI Enhancements
- Real-time sync progress tracking
- Detailed sync history and logs
- Preview changes before applying
- Undo/rollback functionality

## Conclusion

The Variant Sync System provides a robust, error-resilient solution for maintaining consistency between local product variants and Shopify. Its modular design, comprehensive error handling, and intuitive UI make it a reliable tool for managing complex product catalogs with multiple variants and pricing strategies.

The system successfully handles edge cases like option management, price type conversions, mapping consistency, and provides clear feedback to users throughout the sync process. 