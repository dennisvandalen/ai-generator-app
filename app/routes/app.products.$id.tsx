import type { LoaderFunctionArgs, HeadersFunction } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import { useLoaderData, useNavigate, useFetcher, useRevalidator } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import { Page } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import BreadcrumbLink from "app/components/BreadcrumbLink";
import { authenticate } from "~/shopify.server";
import drizzleDb from "~/db.server";
import {
  productsTable,
  aiStylesTable,
  productStylesTable,
  productBasesTable,
  productProductBasesTable,
  productBaseVariantsTable,
  productBaseVariantMappingsTable,
  productBaseOptionsTable,
  productBaseVariantOptionValuesTable,
} from "~/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getShopId } from "~/utils/getShopId";
import { extractShopifyId } from "~/utils/shopHelpers";

// React Hook Form imports
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema and component imports
import {
  ProductFormSchema,
  type ProductFormData,
} from "~/schemas/product";
import { createActionRouter } from "~/utils/createActionRouter";
import { withZodHandler } from "~/utils/withZodHandler";
import { RHFFormSaveBar } from "~/components/RHFFormSaveBar";
import { ProductDetailForm } from "~/components/ProductDetailForm";
import * as z from "zod";

// Types for GraphQL responses
type GraphQLResponse<T = any> = {
  data?: T;
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
};

type GraphQLFetchResponse<T = any> = {
  json(): Promise<GraphQLResponse<T>>;
  errors?: Array<{ message: string; locations?: any[]; path?: string[] }>;
};

// Sync-specific schemas
const SyncVariantsSchema = z.object({
  createMissing: z.boolean().default(true),
  updateExisting: z.boolean().default(true),
  removeOrphaned: z.boolean().default(false),
});

// Helper functions for Shopify API operations
async function fetchShopifyProductVariants(admin: any, productId: string) {
  const query = `
    query GetProductVariants($productId: ID!) {
      product(id: $productId) {
        id
        variants(first: 250) {
          nodes {
            id
            price
            compareAtPrice
            position
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query, { variables: { productId } });
  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data.product?.variants.nodes || [];
}

async function fetchShopifyProductOptions(admin: any, productId: string) {
  const query = `
    query GetProductOptions($productId: ID!) {
      product(id: $productId) {
        options {
          id
          name
          values
          optionValues {
            id
            name
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query, { variables: { productId } });
  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  const options = data.data.product?.options || [];

  // Use optionValues if available (more reliable), fallback to values
  return options.map((option: any) => ({
    ...option,
    values: option.optionValues?.length > 0
      ? option.optionValues.map((ov: any) => ov.name)
      : option.values || []
  }));
}

async function ensureShopifyOptions(admin: any, productId: string, requiredOptions: Record<string, string[]>) {
  const existing = await fetchShopifyProductOptions(admin, productId);

  // Check if product is using default "Title" option (no custom options)
  const hasDefaultTitleOnly = existing.length === 1 && existing[0].name === 'Title';
  const requiredOptionNames = Object.keys(requiredOptions);

  // If we have custom options to add and product only has default Title, we need to handle transition
  if (hasDefaultTitleOnly && requiredOptionNames.length > 0) {
    // For products with only default Title option, we need to replace it with custom options
    console.log('Product has default Title option, transitioning to custom options');

    const mutation = `
      mutation ProductOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options) {
          product { id }
          userErrors { field message code }
        }
      }
    `;

    const variables = {
      productId,
      options: Object.entries(requiredOptions).map(([name, values]) => ({
        name,
        values: values.map(v => ({ name: v }))
      }))
    };

    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();

    if (data.errors || data.data?.productOptionsCreate?.userErrors?.length > 0) {
      throw new Error(`Failed to create options: ${JSON.stringify(data.errors || data.data.productOptionsCreate.userErrors)}`);
    }

    return;
  }

  // Handle existing options - separate new options from missing values for existing options
  const newOptions: Array<{ name: string; values: string[] }> = [];
  const optionsNeedingValues: Array<{ optionId: string; missingValues: string[] }> = [];

  for (const [requiredName, requiredValues] of Object.entries(requiredOptions)) {
    const existingOption = existing.find((o: any) => o.name === requiredName);

    if (!existingOption) {
      // This is a completely new option
      newOptions.push({ name: requiredName, values: requiredValues });
    } else {
      // This option exists, check for missing values (case-insensitive comparison)
      const existingValues = existingOption.values.map((v: string) => v.toLowerCase().trim());
      const missingValues = requiredValues.filter(value =>
        !existingValues.includes(value.toLowerCase().trim())
      );

      console.log(`🔍 Comparing option "${requiredName}":`, {
        existingValues: existingOption.values,
        existingValuesNormalized: existingValues,
        requiredValues,
        requiredValuesNormalized: requiredValues.map(v => v.toLowerCase().trim()),
        missingValues
      });

      if (missingValues.length > 0) {
        console.log(`Option "${requiredName}" needs values:`, {
          existing: existingOption.values,
          required: requiredValues,
          missing: missingValues
        });

        optionsNeedingValues.push({
          optionId: existingOption.id,
          missingValues
        });
      } else {
        console.log(`Option "${requiredName}" already has all required values:`, existingOption.values);
      }
    }
  }

  // Create completely new options if any
  if (newOptions.length > 0) {
    const createMutation = `
      mutation ProductOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options) {
          product { id }
          userErrors { field message code }
        }
      }
    `;

    const createVariables = {
      productId,
      options: newOptions.map(({ name, values }) => ({
        name,
        values: values.map(v => ({ name: v }))
      }))
    };

    const createResponse = await admin.graphql(createMutation, { variables: createVariables });
    const createData = await createResponse.json();

    if (createData.errors || createData.data?.productOptionsCreate?.userErrors?.length > 0) {
      throw new Error(`Failed to create new options: ${JSON.stringify(createData.errors || createData.data.productOptionsCreate.userErrors)}`);
    }
  }

  // Add missing values to existing options if any
  if (optionsNeedingValues.length > 0) {
    for (const { optionId, missingValues } of optionsNeedingValues) {
      try {
        const updateOptionMutation = `
          mutation ProductOptionUpdate($productId: ID!, $optionId: ID!, $optionValuesToAdd: [OptionValueCreateInput!]!) {
            productOptionUpdate(
              productId: $productId
              option: { id: $optionId }
              optionValuesToAdd: $optionValuesToAdd
            ) {
              product { id }
              userErrors { field message code }
            }
          }
        `;

        const updateOptionVariables = {
          productId,
          optionId,
          optionValuesToAdd: missingValues.map(value => ({ name: value }))
        };

        console.log('🔧 Attempting to add option values:', {
          productId,
          optionId,
          missingValues,
          mutation: updateOptionMutation.trim(),
          variables: updateOptionVariables
        });

        const updateOptionResponse = await admin.graphql(updateOptionMutation, { variables: updateOptionVariables });
        const updateOptionData = await updateOptionResponse.json();

        console.log('📤 GraphQL Response:', {
          status: updateOptionResponse.status,
          data: JSON.stringify(updateOptionData, null, 2),
          hasErrors: !!updateOptionData.errors,
          hasUserErrors: !!updateOptionData.data?.productOptionUpdate?.userErrors?.length
        });

        if (updateOptionData.errors || updateOptionData.data?.productOptionUpdate?.userErrors?.length > 0) {
          const userErrors = updateOptionData.data?.productOptionUpdate?.userErrors || [];
          const alreadyExistsErrors = userErrors.filter((error: any) =>
            error.code === 'OPTION_VALUE_ALREADY_EXISTS'
          );

          if (alreadyExistsErrors.length > 0) {
            // Handle "already exists" errors gracefully - try to add remaining values individually
            console.log(`⚠️ Some option values already exist, trying to add remaining values individually:`, alreadyExistsErrors);

            // Find which values already exist based on error field indices
            const existingIndices = new Set(
              alreadyExistsErrors.map((error: any) =>
                parseInt(error.field.find((f: string) => !isNaN(parseInt(f))))
              ).filter((index: number) => !isNaN(index))
            );

            const remainingValues = missingValues.filter((_, index) => !existingIndices.has(index));

            if (remainingValues.length > 0) {
              console.log(`🔄 Attempting to add remaining ${remainingValues.length} values:`, remainingValues);

              // Try to add remaining values one by one
              for (const value of remainingValues) {
                try {
                  const singleValueResponse = await admin.graphql(updateOptionMutation, {
                    variables: {
                      productId,
                      optionId,
                      optionValuesToAdd: [{ name: value }]
                    }
                  });

                  const singleValueData = await singleValueResponse.json();
                  if (singleValueData.data?.productOptionUpdate?.userErrors?.length > 0) {
                    const singleErrors = singleValueData.data.productOptionUpdate.userErrors;
                    const nonExistingErrors = singleErrors.filter((error: any) =>
                      error.code !== 'OPTION_VALUE_ALREADY_EXISTS'
                    );

                    if (nonExistingErrors.length > 0) {
                      console.error(`❌ Failed to add value "${value}":`, nonExistingErrors);
                    } else {
                      console.log(`⚠️ Value "${value}" already exists, skipping`);
                    }
                  } else {
                    console.log(`✅ Successfully added value "${value}"`);
                  }
                } catch (error) {
                  console.error(`❌ Error adding value "${value}":`, error);
                }
              }
            }

            // Check if there were any other non-"already exists" errors
            const otherErrors = userErrors.filter((error: any) =>
              error.code !== 'OPTION_VALUE_ALREADY_EXISTS'
            );

            if (otherErrors.length > 0) {
              console.error(`❌ Other errors while adding option values:`, otherErrors);
              throw new Error(`Failed to add option values: ${JSON.stringify(otherErrors)}`);
            }

            console.log(`✅ Option values processed (some already existed, attempted to add remaining)`);
          } else {
            // Other types of errors should still throw
            console.error(`❌ Failed to add option values:`, updateOptionData.errors || userErrors);
            throw new Error(`Failed to add option values: ${JSON.stringify(updateOptionData.errors || userErrors)}`);
          }
        } else {
          console.log(`✅ Successfully added ${missingValues.length} option values`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if this is an "already exists" error that we can handle gracefully
        if (errorMessage.includes('OPTION_VALUE_ALREADY_EXISTS')) {
          console.log(`⚠️ Option value addition failed with "already exists" error, continuing sync anyway`);
          console.log(`📝 This might be due to race conditions or recent changes to the product`);
        } else {
          // For other errors, log and throw to stop the sync
          console.error(`❌ Critical error while adding option values for option ${optionId}:`, error);
          console.error(`Missing values attempted:`, missingValues);
          throw error;
        }
      }
    }
  }
}

// Helper function to normalize variant option values for comparison
function normalizeVariantOptions(options: Array<{ name: string; value: string }>) {
  // Sort options by name for consistent comparison
  return options
    .filter(opt => opt.name !== 'Title' || options.length === 1) // Keep Title only if it's the only option
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(opt => `${opt.name}:${opt.value}`)
    .join('/');
}

// Helper function to create variant key for local variants
function createLocalVariantKey(optionValues: Record<string, string>) {
  return Object.entries(optionValues)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('/');
}

// Main sync action handler
const syncVariants = withZodHandler(
  SyncVariantsSchema,
  async ({ params }, input, session, admin) => {
    const { id } = params;
    if (!id) throw new Error("Product ID is required");

    const shopId = getShopId(session.shop);
    const currentTime = new Date().toISOString();

    // Get the database product
    const products = await drizzleDb
      .select()
      .from(productsTable)
      .where(eq(productsTable.uuid, id))
      .limit(1);

    if (products.length === 0) {
      throw new Error("Product not found");
    }

    const product = products[0];
    const shopifyGID = `gid://shopify/Product/${product.shopifyProductId}`;

    // Get linked product bases and their variants
    const linkedProductBases = await drizzleDb.query.productProductBasesTable.findMany({
      where: (ppb, { eq }) => eq(ppb.productId, product.id),
      with: {
        productBase: {
          with: {
            variants: {
              with: {
                optionValues: {
                  with: {
                    option: true,
                  },
                },
              },
            },
            options: true,
          },
        },
      },
    });

    if (linkedProductBases.length === 0) {
      return Response.json({
        success: false,
        error: "No product bases linked to this product"
      });
    }

    // Step 1: Validate that all linked product bases have compatible option structures
    console.log('🔍 Validating product base option compatibility...');
    const productBaseOptionStructures = new Map();

    for (const link of linkedProductBases) {
      const productBase = link.productBase;
      const optionNames = productBase.options.map(opt => opt.name).sort();
      const structureKey = optionNames.join(',');

      if (!productBaseOptionStructures.has(structureKey)) {
        productBaseOptionStructures.set(structureKey, {
          optionNames,
          productBases: []
        });
      }

      productBaseOptionStructures.get(structureKey).productBases.push({
        id: productBase.id,
        name: productBase.name
      });
    }

    // Check if all product bases have the same option structure
    if (productBaseOptionStructures.size > 1) {
      console.error('❌ Product bases have incompatible option structures:');
      const incompatibilityDetails = [];

      for (const [structureKey, structure] of productBaseOptionStructures) {
        console.error(`  Options [${structure.optionNames.join(', ')}]:`, structure.productBases.map((pb: { id: string; name: string }) => pb.name));
        incompatibilityDetails.push({
          options: structure.optionNames,
          productBases: structure.productBases.map((pb: { id: string; name: string }) => pb.name)
        });
      }

      return Response.json({
        success: false,
        error: `Product base compatibility error: All linked product bases must have the same option structure. Currently linked product bases have different options. Check the console for details.`,
        details: incompatibilityDetails
      });
    }

    const commonOptionStructure = Array.from(productBaseOptionStructures.keys())[0];
    console.log('✅ All product bases have compatible option structure:', commonOptionStructure);

    // Build local variants map with option values
    const localVariants: any[] = [];
    const requiredOptions: Record<string, Set<string>> = {};

    for (const link of linkedProductBases) {
      for (const variant of link.productBase.variants) {
        const optionValues: Record<string, string> = {};

        for (const optionValue of variant.optionValues) {
          const optionName = optionValue.option.name;
          const value = optionValue.value;
          optionValues[optionName] = value;

          if (!requiredOptions[optionName]) {
            requiredOptions[optionName] = new Set();
          }
          requiredOptions[optionName].add(value);
        }

        localVariants.push({
          id: variant.id,
          optionValues,
          price: (variant.price ?? 0).toString(),
          compareAtPrice: variant.compareAtPrice?.toString(),
        });
      }
    }

    // Step 2: Validate that all variants have values for all required options
    const allOptionNames = Object.keys(requiredOptions);
    console.log('🔍 Validating local variants for complete option coverage...');
    console.log('Required options:', allOptionNames);

    const incompleteVariants = [];

    // Create a mapping of variant ID to product base for better error reporting
    const variantToProductBase = new Map();
    for (const link of linkedProductBases) {
      for (const variant of link.productBase.variants) {
        variantToProductBase.set(variant.id, {
          productBaseName: link.productBase.name,
          productBaseId: link.productBase.id
        });
      }
    }

    for (const variant of localVariants) {
      const missingOptions = allOptionNames.filter(optionName => !variant.optionValues[optionName]);
      if (missingOptions.length > 0) {
        const productBaseInfo = variantToProductBase.get(variant.id);
        incompleteVariants.push({
          variantId: variant.id,
          productBaseName: productBaseInfo?.productBaseName || 'Unknown',
          existingOptions: Object.keys(variant.optionValues),
          missingOptions,
          currentOptionValues: variant.optionValues
        });
      }
    }

    if (incompleteVariants.length > 0) {
      console.error('❌ Found variants with incomplete option values:');

      // Group by product base for clearer error reporting
      const variantsByProductBase: Record<string, Array<typeof incompleteVariants[number]>> = {};
      for (const variant of incompleteVariants) {
        if (!variantsByProductBase[variant.productBaseName]) {
          variantsByProductBase[variant.productBaseName] = [];
        }
        variantsByProductBase[variant.productBaseName].push(variant);
      }

      for (const [productBaseName, variants] of Object.entries(variantsByProductBase) as [string, Array<typeof incompleteVariants[number]>][]) {
        console.error(`  Product Base "${productBaseName}":`);
        for (const variant of variants) {
          console.error(`    Variant ${variant.variantId}: Missing options [${variant.missingOptions.join(', ')}], Has [${variant.existingOptions.join(', ')}]`);
          console.error(`      Current values:`, variant.currentOptionValues);
        }
      }

      return Response.json({
        success: false,
        error: `Product base configuration error: Some variants are missing option values. All variants must have values for all options (${allOptionNames.join(', ')}). Check the console for details about which product bases and variants need to be updated.`
      });
    }

    console.log('✅ All variants have complete option values');

    // Convert required options to the format expected by ensureShopifyOptions
    const requiredOptionsArray: Record<string, string[]> = {};
    for (const [name, values] of Object.entries(requiredOptions)) {
      requiredOptionsArray[name] = Array.from(values);
    }

    // Step 1: Fetch current Shopify variants and options
    const [shopifyVariants, shopifyOptions] = await Promise.all([
      fetchShopifyProductVariants(admin, shopifyGID),
      fetchShopifyProductOptions(admin, shopifyGID)
    ]);

    // Check if Shopify product uses default Title option
    const hasDefaultTitleOnly = shopifyOptions.length === 1 && shopifyOptions[0].name === 'Title';

    // Step 2: Handle option management carefully
    if (Object.keys(requiredOptionsArray).length > 0) {
      await ensureShopifyOptions(admin, shopifyGID, requiredOptionsArray);

      // Add a small delay and verify options were created properly
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all required option values actually exist in Shopify
      const updatedOptions = await fetchShopifyProductOptions(admin, shopifyGID);
      const missingOptionValues = [];

      for (const [requiredName, requiredValues] of Object.entries(requiredOptionsArray)) {
        const shopifyOption = updatedOptions.find((o: any) => o.name === requiredName);
        if (!shopifyOption) {
          missingOptionValues.push(`Option "${requiredName}" not found in Shopify`);
          continue;
        }

        const existingValues = shopifyOption.values.map((v: string) => v.toLowerCase().trim());
        const missingValues = requiredValues.filter(value =>
          !existingValues.includes(value.toLowerCase().trim())
        );

        console.log(`🔍 Validation - Comparing option "${requiredName}":`, {
          existingValues: shopifyOption.values,
          existingValuesNormalized: existingValues,
          requiredValues,
          requiredValuesNormalized: requiredValues.map(v => v.toLowerCase().trim()),
          missingValues
        });

        if (missingValues.length > 0) {
          missingOptionValues.push(`Option "${requiredName}" missing values: ${missingValues.join(', ')}`);
        }
      }

      if (missingOptionValues.length > 0) {
        console.error('❌ Option validation failed:', missingOptionValues);
        console.log('💡 Suggestions to fix this:');
        console.log('1. Check your product base configuration to ensure option values match what exists in Shopify');
        console.log('2. Manually add the missing option values in Shopify admin');
        console.log('3. Update your product base to use existing option values');

        return Response.json({
          success: false,
          error: `Option validation failed: ${missingOptionValues.join('; ')}. Please check the console for suggestions on how to fix this.`
        });
      }
    }

    // Step 3: Create variant maps for comparison
    const shopifyMap = new Map();
    const localMap = new Map();

    // Map Shopify variants
    for (const variant of shopifyVariants) {
      if (hasDefaultTitleOnly && variant.selectedOptions.length === 1 && variant.selectedOptions[0].name === 'Title') {
        // Skip default variant when transitioning to custom options
        continue;
      }

      const key = normalizeVariantOptions(variant.selectedOptions);
      if (key) { // Only add non-empty keys
        shopifyMap.set(key, variant);
      }
    }

    // Map local variants
    for (const variant of localVariants) {
      const key = createLocalVariantKey(variant.optionValues);
      localMap.set(key, variant);
    }

    // Step 4: Build mutation batches with enhanced price checking
    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const toDelete: string[] = [];

    // Track sync details for better reporting
    let variantsNeedingPriceUpdate = 0;
    let variantsToCreate = 0;
    let variantsToDelete = 0;

    // Check what needs to be created or updated
    for (const [key, localVariant] of localMap) {
      if (shopifyMap.has(key)) {
        // Variant exists, check if prices need updating
        const shopifyVariant = shopifyMap.get(key);
        const priceNeedsUpdate = parseFloat(shopifyVariant.price) !== parseFloat(localVariant.price);

        // Better compareAtPrice logic - handle null/undefined properly (matching loader logic)
        const localHasCompareAt = localVariant.compareAtPrice != null;
        const shopifyHasCompareAt = shopifyVariant.compareAtPrice != null && shopifyVariant.compareAtPrice !== undefined;

        let compareAtPriceNeedsUpdate = false;
        if (localHasCompareAt !== shopifyHasCompareAt) {
          // One has compareAtPrice, the other doesn't
          compareAtPriceNeedsUpdate = true;
        } else if (localHasCompareAt && shopifyHasCompareAt) {
          // Both have compareAtPrice, compare values
          const shopifyCompareAtPrice = parseFloat(shopifyVariant.compareAtPrice);
          const localCompareAtPrice = parseFloat(localVariant.compareAtPrice.toString());
          compareAtPriceNeedsUpdate = shopifyCompareAtPrice !== localCompareAtPrice;
        }

        const needsPriceUpdate = priceNeedsUpdate || compareAtPriceNeedsUpdate;

        if (needsPriceUpdate) {
          variantsNeedingPriceUpdate++;

          if (input.updateExisting) {
            const updateData: any = {
              id: shopifyVariant.id,
              price: localVariant.price,
              compareAtPrice: localVariant.compareAtPrice || null,
            };

            toUpdate.push(updateData);
          }
        }
      } else if (input.createMissing) {
        // Variant doesn't exist, create it
        variantsToCreate++;

        const createData: any = {
          price: localVariant.price,
          compareAtPrice: localVariant.compareAtPrice || null,
          inventoryItem: {
            tracked: false
          },
          optionValues: Object.entries(localVariant.optionValues).map(([name, val]) => ({
            optionName: name,
            name: val
          }))
        };

        toCreate.push(createData);
      }
    }

    // Find orphaned variants to delete
    if (input.removeOrphaned) {
      for (const [key, shopifyVariant] of shopifyMap) {
        if (!localMap.has(key)) {
          variantsToDelete++;
          toDelete.push(shopifyVariant.id);
        }
      }
    }

    // Log detailed sync analysis
    console.log('📊 Sync Analysis:', {
      variantsToCreate,
      variantsNeedingPriceUpdate,
      variantsToDelete,
      willCreateVariants: toCreate.length,
      willUpdatePrices: toUpdate.length,
      willDeleteVariants: toDelete.length,
      syncOptions: {
        createMissing: input.createMissing,
        updateExisting: input.updateExisting,
        removeOrphaned: input.removeOrphaned
      }
    });

    // Step 5: Execute mutations
    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [] as string[]
    };

    // Create variants
    if (toCreate.length > 0) {
      try {
        const createMutation = `
          mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkCreate(productId: $productId, variants: $variants) {
              productVariants {
                id
                selectedOptions {
                  name
                  value
                }
              }
              userErrors { field message code }
            }
          }
        `;

        const createResponse = await admin.graphql(createMutation, {
          variables: {
            productId: shopifyGID,
            variants: toCreate
          }
        });

        const createData: GraphQLResponse = await createResponse.json();

        if (createData.errors || createData.data?.productVariantsBulkCreate?.userErrors?.length > 0) {
          const errors = createData.errors || createData.data.productVariantsBulkCreate.userErrors;
          console.error('❌ Variant creation failed:', errors);
          console.error('📋 Attempted to create variants:', JSON.stringify(toCreate, null, 2));
          results.errors.push(`Create errors: ${JSON.stringify(errors)}`);
        } else {
          results.created = createData.data.productVariantsBulkCreate.productVariants.length;

          // Update mappings for newly created variants
          console.log('=== MAPPING DEBUG ===');
          console.log('Local variants map keys:', Array.from(localMap.keys()));

          const mappingsToInsert = [];
          for (const newVariant of createData.data.productVariantsBulkCreate.productVariants) {
            const shopifyKey = normalizeVariantOptions(newVariant.selectedOptions);
            console.log('Shopify variant:', {
              id: newVariant.id,
              options: newVariant.selectedOptions,
              generatedKey: shopifyKey
            });

            let localVariant = localMap.get(shopifyKey);

            // If exact match fails, try fuzzy matching
            if (!localVariant) {
              console.log('Exact match failed, trying fuzzy matching...');

              // Try to find variant by matching option values regardless of order
              for (const [localKey, variant] of localMap) {
                const localOptions = variant.optionValues;
                const shopifyOptions = Object.fromEntries(
                  newVariant.selectedOptions.map((opt: any) => [opt.name, opt.value])
                );

                // Check if all option values match
                const optionNamesMatch = Object.keys(localOptions).length === Object.keys(shopifyOptions).length;
                const valuesMatch = optionNamesMatch && Object.entries(localOptions).every(
                  ([name, value]) => shopifyOptions[name] === value
                );

                if (valuesMatch) {
                  console.log('Found fuzzy match:', { localKey, shopifyKey, variant: variant.id });
                  localVariant = variant;
                  break;
                }
              }
            }

            if (localVariant) {
              console.log('Creating mapping:', {
                productId: product.id,
                productBaseVariantId: localVariant.id,
                shopifyVariantId: parseInt(extractShopifyId(newVariant.id))
              });

              mappingsToInsert.push({
                productId: product.id,
                productBaseVariantId: localVariant.id,
                shopifyVariantId: parseInt(extractShopifyId(newVariant.id)),
                isActive: true,
                createdAt: currentTime,
                updatedAt: currentTime,
              });
            } else {
              console.log('WARNING: Could not find local variant for Shopify variant:', {
                shopifyVariantId: newVariant.id,
                shopifyOptions: newVariant.selectedOptions,
                shopifyKey
              });
              results.errors.push(`Could not map variant with options: ${JSON.stringify(newVariant.selectedOptions)}`);
            }
          }

          // Insert all mappings in batch
          if (mappingsToInsert.length > 0) {
            console.log(`Inserting ${mappingsToInsert.length} mappings...`);
            await drizzleDb
              .insert(productBaseVariantMappingsTable)
              .values(mappingsToInsert)
              .onConflictDoNothing();
            console.log('Mappings inserted successfully');
          } else {
            console.log('No mappings to insert');
          }

          console.log('=== END MAPPING DEBUG ===');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`Create failed: ${errorMessage}`);
      }
    }

    console.log('📊 Sync Analysis:');
    console.log(`Variants to create: ${toCreate.length}`);
    console.log(`Variants to update: ${toUpdate.length}`);
    console.log(`Variants to delete: ${toDelete.length}`);

    if (toUpdate.length > 0) {
      console.log('🔄 UPDATE PAYLOAD DEBUG:');
      toUpdate.forEach((variant, index) => {
        console.log(`Update ${index + 1}:`, {
          id: variant.id,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          isComparePriceNull: variant.compareAtPrice === null,
          isComparePriceUndefined: variant.compareAtPrice === undefined
        });
      });
    }

    // Execute bulk mutations
    const mutationResults = [];

    if (toUpdate.length > 0 && input.updateExisting) {
      console.log('🔄 BULK UPDATE DEBUG:');
      console.log('Number of variants to update:', toUpdate.length);
      toUpdate.forEach((variant, index) => {
        console.log(`Update ${index + 1}:`, {
          id: variant.id,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          hasCompareAtPrice: variant.compareAtPrice !== null && variant.compareAtPrice !== undefined
        });
      });

      const updateResult = await admin.graphql(
        `mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
              compareAtPrice
            }
            userErrors {
              field
              message
              code
            }
          }
        }`,
        {
          variables: {
            productId: shopifyGID,
            variants: toUpdate,
          },
        }
      );

      const updateData = await updateResult.json();
      console.log('📤 UPDATE RESULT:', {
        userErrors: updateData.data?.productVariantsBulkUpdate?.userErrors,
        updatedVariants: updateData.data?.productVariantsBulkUpdate?.productVariants?.map((v: any) => ({
          id: v.id,
          price: v.price,
          compareAtPrice: v.compareAtPrice
        }))
      });

      mutationResults.push(updateData);
    }

    // Delete variants
    if (toDelete.length > 0) {
      try {
        const deleteMutation = `
          mutation ProductVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
            productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
              product { id }
              userErrors { field message code }
            }
          }
        `;

        const deleteResponse = await admin.graphql(deleteMutation, {
          variables: {
            productId: shopifyGID,
            variantsIds: toDelete
          }
        });

        const deleteData: GraphQLResponse = await deleteResponse.json();

        if (deleteData.errors || deleteData.data?.productVariantsBulkDelete?.userErrors?.length > 0) {
          results.errors.push(`Delete errors: ${JSON.stringify(deleteData.errors || deleteData.data.productVariantsBulkDelete.userErrors)}`);
        } else {
          results.deleted = toDelete.length;

          // Remove mappings for deleted variants
          const numericIds = toDelete.map(id => parseInt(extractShopifyId(id)));
          await drizzleDb
            .delete(productBaseVariantMappingsTable)
            .where(inArray(productBaseVariantMappingsTable.shopifyVariantId, numericIds));
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`Delete failed: ${errorMessage}`);
      }
    }

    // Prepare response message
    const actions = [];
    if (results.created > 0) actions.push(`created ${results.created} variant(s)`);
    if (results.updated > 0) actions.push(`updated ${results.updated} variant(s)`);
    if (results.deleted > 0) actions.push(`deleted ${results.deleted} variant(s)`);

    if (results.errors.length > 0) {
      return Response.json({
        success: false,
        error: `Sync completed with errors. ${actions.join(', ')}. Errors: ${results.errors.join('; ')}`
      });
    }

    return Response.json({
      success: true,
      message: actions.length > 0
        ? `Variant sync completed: ${actions.join(', ')}`
        : "Variant sync completed successfully: no changes needed"
    });
  }
);

// Action handlers (keeping the existing ones but using them with the new form)
const updateProductSettings = withZodHandler(
  ProductFormSchema,
  async ({ params }, input, session, admin) => {
    const { id } = params;
    if (!id) throw new Error("Product ID is required");

    const shopId = getShopId(session.shop);
    const currentTime = new Date().toISOString();

    // Get the database product
    const product = await drizzleDb
      .select()
      .from(productsTable)
      .where(eq(productsTable.uuid, id))
      .limit(1);

    if (product.length === 0) {
      throw new Error("Product not found");
    }

    const productId = product[0].id;

    // Update product enabled status
    await drizzleDb
      .update(productsTable)
      .set({
        isEnabled: input.isEnabled,
        updatedAt: currentTime,
      })
      .where(eq(productsTable.id, productId));

    // Handle AI Styles
    const aiStyles = await drizzleDb
      .select()
      .from(aiStylesTable)
      .where(eq(aiStylesTable.shopId, shopId));

    const styleUuidToId = new Map(aiStyles.map(style => [style.uuid, style.id]));

    // Delete existing product-style relationships
    await drizzleDb
      .delete(productStylesTable)
      .where(eq(productStylesTable.productId, productId));

    // Insert new style relationships
    if (input.selectedStyles && input.selectedStyles.length > 0) {
      const productStylesToInsert = input.selectedStyles.map((styleUuid: string, index: number) => {
        const styleId = styleUuidToId.get(styleUuid);
        if (!styleId) throw new Error(`Style not found: ${styleUuid}`);

        const reorderedStyle = input.reorderedStyles?.find(rs => rs.uuid === styleUuid);
        const sortOrder = reorderedStyle ? reorderedStyle.sortOrder : index;

        return {
          productId,
          aiStyleId: styleId,
          sortOrder,
          isEnabled: true,
          createdAt: currentTime,
          updatedAt: currentTime,
        };
      });

      await drizzleDb
        .insert(productStylesTable)
        .values(productStylesToInsert);
    }

    // Handle product bases
    const productBases = await drizzleDb
      .select()
      .from(productBasesTable)
      .where(eq(productBasesTable.shopId, shopId));

    const productBaseUuidToId = new Map(productBases.map(pb => [pb.uuid, pb.id]));

    // Delete existing product-product base relationships
    await drizzleDb
      .delete(productProductBasesTable)
      .where(eq(productProductBasesTable.productId, productId));

    // Insert new product base relationships
    if (input.selectedProductBases && input.selectedProductBases.length > 0) {
      const productProductBasesToInsert = input.selectedProductBases.map((productBaseUuid: string, index: number) => {
        const productBaseId = productBaseUuidToId.get(productBaseUuid);
        if (!productBaseId) throw new Error(`Product base not found: ${productBaseUuid}`);

        return {
          productId,
          productBaseId,
          sortOrder: index,
          isEnabled: true,
          createdAt: currentTime,
          updatedAt: currentTime,
        };
      });

      await drizzleDb
        .insert(productProductBasesTable)
        .values(productProductBasesToInsert);
    }

    // Handle variant mappings
    await drizzleDb
      .delete(productBaseVariantMappingsTable)
      .where(eq(productBaseVariantMappingsTable.productId, productId));

    if (input.variantMappings && input.variantMappings.length > 0) {
      const mappingsToInsert = input.variantMappings.map(mapping => ({
        productId,
        productBaseVariantId: mapping.productBaseVariantId,
        shopifyVariantId: parseInt(extractShopifyId(mapping.shopifyVariantId)),
        isActive: true,
        createdAt: currentTime,
        updatedAt: currentTime,
      }));

      await drizzleDb
        .insert(productBaseVariantMappingsTable)
        .values(mappingsToInsert);
    }

    // Update Shopify metafields
    const shopifyGID = `gid://shopify/Product/${product[0].shopifyProductId}`;
    try {
      await admin.graphql(
        `mutation UpdateProductMetafields($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id }
            userErrors { field message }
          }
        }`,
        {
          variables: {
            input: {
              id: shopifyGID,
              metafields: [
                {
                  namespace: "custom",
                  key: "ai_enabled",
                  value: String(input.isEnabled),
                  type: "boolean"
                },
                {
                  namespace: "custom",
                  key: "last_updated",
                  value: currentTime,
                  type: "date_time"
                }
              ]
            }
          }
        }
      );
    } catch (error) {
      console.error("Error updating metafields:", error);
    }

    return Response.json({
      success: true,
      message: `Product ${input.isEnabled ? 'enabled' : 'disabled'} for AI generation with ${input.selectedStyles?.length || 0} style(s), ${input.selectedProductBases?.length || 0} product base(s), and ${input.variantMappings?.length || 0} variant mapping(s) saved`
    });
  }
);

export const action = createActionRouter({
  "save-product-settings": updateProductSettings,
  "sync-variants": syncVariants,
});

// Loader remains the same
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  if (!params.id) {
    throw new Response("Product UUID is required", { status: 400 });
  }

  // First fetch the product
  const products = await drizzleDb
    .select()
    .from(productsTable)
    .where(eq(productsTable.uuid, params.id))
    .limit(1);

  if (products.length === 0) {
    throw new Response("Product not found", { status: 404 });
  }

  const product = products[0];

  // Fetch all other required data
  const [
    aiStyles,
    productStyles,
    productBases,
    productProductBases,
    productBaseVariants,
    productBaseOptions,
    productBaseVariantOptionValues,
    variantMappings
  ] = await Promise.all([
    // AI Styles for this shop
    drizzleDb
      .select()
      .from(aiStylesTable)
      .where(eq(aiStylesTable.shopId, shopId)),
    // Product-Style relationships
    drizzleDb.query.productStylesTable.findMany({
      where: (ps, { eq }) => eq(ps.productId, product.id),
      orderBy: (ps, { asc }) => [asc(ps.sortOrder)],
      with: {
        aiStyle: true,
      },
    }),
    // Product Bases for this shop
    drizzleDb
      .select()
      .from(productBasesTable)
      .where(eq(productBasesTable.shopId, shopId))
      .orderBy(productBasesTable.sortOrder, productBasesTable.name),
    // Product-Product Base relationships
    drizzleDb.query.productProductBasesTable.findMany({
      where: (ppb, { eq }) => eq(ppb.productId, product.id),
      orderBy: (ppb, { asc }) => [asc(ppb.sortOrder)],
      with: {
        productBase: true,
      },
    }),
    // Product Base Variants
    drizzleDb
      .select()
      .from(productBaseVariantsTable),
    // Product Base Options
    drizzleDb
      .select()
      .from(productBaseOptionsTable),
    // Product Base Variant Option Values
    drizzleDb
      .select()
      .from(productBaseVariantOptionValuesTable),
    // Variant Mappings
    drizzleDb.query.productBaseVariantMappingsTable.findMany({
      where: (vm, { eq }) => eq(vm.productId, product.id),
      with: {
        productBaseVariant: true,
      },
    })
  ]);

  // Process selected styles
  const selectedStyles = productStyles
    .filter(ps => ps.isEnabled)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(ps => ps.aiStyle?.uuid || '')
    .filter(uuid => uuid);

  // Process linked product bases
  const selectedProductBases = productProductBases
    .filter(ppb => ppb.isEnabled)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(ppb => ppb.productBase?.uuid || '')
    .filter(uuid => uuid);

  // Fetch actual Shopify product data and clean up invalid mappings
  let shopifyProduct = null;
  let cleanedVariantMappings = variantMappings;

  try {
    const { admin } = await authenticate.admin(request);
    const shopifyGID = `gid://shopify/Product/${product.shopifyProductId}`;

    const response = await admin.graphql(
      `query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          featuredImage {
            url(transform: { maxWidth: 200, maxHeight: 200 })
          }
          variants(first: 250) {
            nodes {
              id
              title
              price
              compareAtPrice
              displayName
              position
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }`,
      { variables: { id: shopifyGID } }
    );

    const responseData = await response.json();
    if (responseData.data?.product) {
      const shopifyVariants = responseData.data.product.variants.nodes;

      // Create set of existing Shopify variant IDs for fast lookup
      const existingShopifyVariantIds = new Set(
        shopifyVariants.map((v: any) => parseInt(extractShopifyId(v.id)))
      );

      // Find invalid mappings (pointing to deleted Shopify variants)
      const invalidMappings = variantMappings.filter(
        mapping => !existingShopifyVariantIds.has(mapping.shopifyVariantId)
      );

      // Clean up invalid mappings if any found
      if (invalidMappings.length > 0) {
        console.log(`🧹 Cleaning up ${invalidMappings.length} invalid variant mappings`);

        const invalidMappingIds = invalidMappings.map(m => m.id);
        await drizzleDb
          .delete(productBaseVariantMappingsTable)
          .where(inArray(productBaseVariantMappingsTable.id, invalidMappingIds));

        // Filter out invalid mappings from the response
        cleanedVariantMappings = variantMappings.filter(
          mapping => existingShopifyVariantIds.has(mapping.shopifyVariantId)
        );

        console.log(`✅ Cleaned up invalid mappings. ${cleanedVariantMappings.length} valid mappings remaining.`);
      }

      shopifyProduct = {
        id: responseData.data.product.id,
        title: responseData.data.product.title,
        handle: responseData.data.product.handle,
        shop: session.shop,
        featuredImage: responseData.data.product.featuredImage?.url,
        variants: shopifyVariants.map((variant: any) => ({
          id: variant.id,
          title: variant.displayName || variant.title,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          selectedOptions: variant.selectedOptions,
        })),
      };
    }
  } catch (error) {
    console.error("Error fetching Shopify product:", error);
    // Fallback to basic product info
    shopifyProduct = {
      id: `gid://shopify/Product/${product.shopifyProductId}`,
      title: product.title || "Product Title",
      handle: "",
      shop: session.shop,
      featuredImage: undefined,
      variants: [],
    };
  }

  // Process variant mappings - convert numeric IDs to Shopify GID format for the form
  const processedVariantMappings = cleanedVariantMappings.map(mapping => ({
    productBaseVariantId: mapping.productBaseVariantId,
    shopifyVariantId: `gid://shopify/ProductVariant/${mapping.shopifyVariantId}`,
  }));

  // Calculate sync status for UI (detect price mismatches)
  let variantsNeedingPriceSync = 0;
  if (shopifyProduct && shopifyProduct.variants.length > 0) {
    // Create a map of product base variants for price comparison
    const productBaseVariantMap = new Map();

    // Get all linked product bases and their variants for this product
    const linkedProductBases = await drizzleDb.query.productProductBasesTable.findMany({
      where: (ppb, { eq }) => eq(ppb.productId, product.id),
      with: {
        productBase: {
          with: {
            variants: true,
          },
        },
      },
    });

    // Build map of product base variants by ID
    for (const link of linkedProductBases) {
      for (const variant of link.productBase.variants) {
        productBaseVariantMap.set(variant.id, variant);
      }
    }

    // Check each mapping for price mismatches
    for (const mapping of cleanedVariantMappings) {
      const productBaseVariant = productBaseVariantMap.get(mapping.productBaseVariantId);
      const shopifyVariant = shopifyProduct.variants.find((v: any) =>
        parseInt(extractShopifyId(v.id)) === mapping.shopifyVariantId
      );

      if (productBaseVariant && shopifyVariant) {
        const shopifyPrice = parseFloat(shopifyVariant.price);
        const localPrice = parseFloat((productBaseVariant.price ?? 0).toString());

        const priceNeedsUpdate = shopifyPrice !== localPrice;

        // Better compareAtPrice logic - handle null/undefined properly
        const localHasCompareAt = productBaseVariant.compareAtPrice != null;
        const shopifyHasCompareAt = shopifyVariant.compareAtPrice != null && shopifyVariant.compareAtPrice !== undefined;

        let compareAtPriceNeedsUpdate = false;
        if (localHasCompareAt !== shopifyHasCompareAt) {
          // One has compareAtPrice, the other doesn't
          compareAtPriceNeedsUpdate = true;
        } else if (localHasCompareAt && shopifyHasCompareAt) {
          // Both have compareAtPrice, compare values
          const shopifyCompareAtPrice = parseFloat(shopifyVariant.compareAtPrice);
          const localCompareAtPrice = parseFloat(productBaseVariant.compareAtPrice.toString());
          compareAtPriceNeedsUpdate = shopifyCompareAtPrice !== localCompareAtPrice;
        }

        // Debug logging
        console.log('=== PRICE SYNC DEBUG ===');
        console.log('Mapping ID:', mapping.productBaseVariantId, '→', mapping.shopifyVariantId);
        console.log('Shopify price:', shopifyVariant.price, '(type:', typeof shopifyVariant.price, ')');
        console.log('Local price:', productBaseVariant.price, '(type:', typeof productBaseVariant.price, ')');
        console.log('Parsed shopify price:', shopifyPrice, '(type:', typeof shopifyPrice, ')');
        console.log('Parsed local price:', localPrice, '(type:', typeof localPrice, ')');
        console.log('Price needs update:', priceNeedsUpdate);

        console.log('Local has compareAt:', localHasCompareAt, productBaseVariant.compareAtPrice);
        console.log('Shopify has compareAt:', shopifyHasCompareAt, shopifyVariant.compareAtPrice);
        console.log('CompareAtPrice needs update:', compareAtPriceNeedsUpdate);
        console.log('========================');

        if (priceNeedsUpdate || compareAtPriceNeedsUpdate) {
          variantsNeedingPriceSync++;
        }
      }
    }
  }

  return Response.json({
    product,
    aiStyles,
    productBases,
    productBaseVariants,
    productBaseOptions,
    productBaseVariantOptionValues,
    selectedStyles,
    selectedProductBases,
    variantMappings: processedVariantMappings,
    shopifyProduct,
    syncStatus: {
      variantsNeedingPriceSync,
    },
  });
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function ProductDetailPageRHF() {
  const {
    product,
    aiStyles,
    productBases,
    productBaseVariants,
    productBaseOptions,
    productBaseVariantOptionValues,
    selectedStyles,
    selectedProductBases,
    variantMappings,
    shopifyProduct,
    syncStatus,
  } = useLoaderData<typeof loader>();

  const fetcher = useFetcher();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [isClient, setIsClient] = useState(false);
  const appBridge = useAppBridge();
  const shopify = isClient ? appBridge : null;

  // State for complex operations
  const [creatingVariants, setCreatingVariants] = useState(false);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsClient(true);
  }, []);

  // React Hook Form setup with proper typing
  const form = useForm<ProductFormData>({
    resolver: zodResolver(ProductFormSchema),
    mode: 'onChange',
    defaultValues: {
      isEnabled: false,
      selectedStyles: [],
      selectedProductBases: [],
      variantMappings: [],
      reorderedStyles: [],
    },
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

  // Track if form has been initialized
  const [formInitialized, setFormInitialized] = useState(false);

  // Initialize form with existing data - only run once when data loads
  useEffect(() => {
    if (product && !formInitialized) {
      const initialData: ProductFormData = {
        isEnabled: product.isEnabled || false,
        selectedStyles: selectedStyles || [],
        selectedProductBases: selectedProductBases || [],
        variantMappings: variantMappings || [],
        reorderedStyles: (selectedStyles || []).map((uuid: string, index: number) => ({
          uuid,
          sortOrder: index,
        })),
      };
      form.reset(initialData);
      setFormInitialized(true);
    }
  }, [product?.id, selectedStyles, selectedProductBases, variantMappings, form, formInitialized]);

  // Update variant mappings when loader data changes (after revalidation)
  useEffect(() => {
    if (formInitialized && variantMappings) {
      const currentFormData = form.getValues();
      // Only update if the mappings actually changed
      if (JSON.stringify(currentFormData.variantMappings) !== JSON.stringify(variantMappings)) {
        console.log('🔄 Updating form with fresh variant mappings:', variantMappings);
        form.setValue('variantMappings', variantMappings, { shouldDirty: false });
      }
    }
  }, [variantMappings, form, formInitialized]);

  // Form submission handler
  const handleSave = (data: ProductFormData) => {
    const submitData = { ...data, _action: "save-product-settings" };
    fetcher.submit(submitData, { method: "post", encType: "application/json" });
  };

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      // Type assertion to add properties to fetcher.data
      const fetcherData = fetcher.data as { success?: boolean; message?: string; error?: string };
      if (fetcherData.success) {
        // Check if this was a sync operation that needs state refresh
        // Only true sync operations should trigger revalidation
        const isSyncOperation = fetcherData.message?.includes('Variant sync completed') || false;

        if (isSyncOperation) {
          // For sync operations, revalidate to refresh the data
          revalidator.revalidate();
          if (fetcherData.message) {
            shopify?.toast.show(fetcherData.message, { duration: 3000 });
          }
        } else {
          // For regular saves (including mapping changes), just mark form as clean
          const currentValues = form.getValues();
          form.reset(currentValues);
          shopify?.toast.show(fetcherData.message || "Changes saved successfully", { duration: 3000 });
        }
      } else if (fetcherData.error) {
        console.error("Save failed:", fetcherData.error);
        shopify?.toast.show(fetcherData.error, { isError: true });
      }
    }
  }, [fetcher.state, fetcher.data, shopify, form, navigate]);

  // Complex operation handlers - simplified to use the comprehensive sync
  const handleSyncVariants = useCallback((options: { createMissing: boolean; updateExisting: boolean; removeOrphaned: boolean }) => {
    if (formInitialized && isDirty) {
      shopify?.toast.show("Please save your changes before syncing variants", { isError: true });
      return;
    }

    const actions = [];
    if (options.createMissing) actions.push("create missing variants");
    if (options.updateExisting) actions.push("update existing variants");
    if (options.removeOrphaned) actions.push("remove orphaned variants");

    if (actions.length === 0) {
      shopify?.toast.show("Please select at least one sync option", { isError: true });
      return;
    }

    if (confirm(`Are you sure you want to sync variants? This will: ${actions.join(", ")}.`)) {
      setCreatingVariants(true);
      fetcher.submit(
        { ...options, _action: "sync-variants" },
        { method: "post", encType: "application/json" }
      );
    }
  }, [fetcher, formInitialized, isDirty, shopify]);

  // Deprecated handlers - keeping for compatibility but showing warnings
  const handleVariantCreate = useCallback((data: any) => {
    shopify?.toast.show("Please use the 'Sync Variants' button instead for creating variants", { isError: true });
  }, [shopify]);

  const handleVariantDelete = useCallback((variantId: string) => {
    shopify?.toast.show("Please use the 'Sync Variants' button instead for deleting variants", { isError: true });
  }, [shopify]);

  const handleVariantPriceUpdate = useCallback((variantId: string, price: string) => {
    shopify?.toast.show("Please use the 'Sync Variants' button instead for updating variant prices", { isError: true });
  }, [shopify]);

  const handleEditingPriceChange = useCallback((variantId: string, price: string | null) => {
    setEditingPrices(prev => {
      const next = { ...prev };
      if (price !== null) {
        next[variantId] = price;
      } else {
        delete next[variantId];
      }
      return next;
    });
  }, []);

  const handleCreateAllMissingVariants = useCallback((productBaseVariantIds: number[]) => {
    shopify?.toast.show("Please use the 'Sync Variants' button instead for creating variants", { isError: true });
  }, [shopify]);

  const handleDeleteAllUnmappedVariants = useCallback((variantIds: string[]) => {
    shopify?.toast.show("Please use the 'Sync Variants' button instead for deleting variants", { isError: true });
  }, [shopify]);

  const handleCleanupVariantMappings = useCallback(() => {
    if (confirm("Are you sure you want to cleanup invalid and duplicate variant mappings? This will remove broken mappings that point to non-existent variants.")) {
      // This is a local operation that doesn't affect Shopify, so we can keep it
      fetcher.submit(
        { _action: "cleanup-variant-mappings" },
        { method: "post", encType: "application/json" }
      );
    }
  }, [fetcher]);

  // Reset creating variants state when fetcher completes
  useEffect(() => {
    if (fetcher.state === 'idle' && creatingVariants) {
      setCreatingVariants(false);
    }
  }, [fetcher.state, creatingVariants]);

  // Create interface wrapper for ProductDetailForm component
  const formInterface = {
    data: formData,
    errors: Object.fromEntries(
      Object.entries(errors).map(([key, error]) => [key, error?.message || ""])
    ),
    setField: (field: keyof ProductFormData, value: any) =>
      setValue(field, value, { shouldDirty: true }),
    submit: () => handleSave(formData),
    isSubmitting: fetcher.state === 'submitting',
  };

  const handleFormSave = (data: ProductFormData) => {
    handleSave(data);
  };

  return (
    <Page
      title={`Product: ${product.title || 'Untitled'}`}
      titleMetadata={product.isEnabled ? <span style={{ color: 'green' }}>●</span> : <span style={{ color: 'red' }}>●</span>}
      backAction={{
        content: "Products",
        onAction: () => navigate("/app/products"),
      }}
    >
      <TitleBar title={`Configure: ${product.title || 'Untitled'}`}>
        <BreadcrumbLink to="/app/products">Products</BreadcrumbLink>
      </TitleBar>

      <RHFFormSaveBar
        form={form}
        onSave={handleFormSave}
        onDiscard={() => {
          reset();
          shopify?.toast.show("Changes discarded", { duration: 2000 });
        }}
      />

      <ProductDetailForm
        form={formInterface}
        aiStyles={aiStyles}
        productBases={productBases}
        productBaseVariants={productBaseVariants}
        productBaseOptions={productBaseOptions}
        productBaseVariantOptionValues={productBaseVariantOptionValues}
        shopifyProduct={shopifyProduct}
        syncStatus={syncStatus}
        onVariantCreate={handleVariantCreate}
        onVariantDelete={handleVariantDelete}
        onVariantPriceUpdate={handleVariantPriceUpdate}
        onCreateAllMissingVariants={handleCreateAllMissingVariants}
        onDeleteAllUnmappedVariants={handleDeleteAllUnmappedVariants}
        onSyncVariants={handleSyncVariants}
        onCleanupVariantMappings={handleCleanupVariantMappings}
        creatingVariants={creatingVariants}
        editingPrices={editingPrices}
        onEditingPriceChange={handleEditingPriceChange}
      />
    </Page>
  );
}
