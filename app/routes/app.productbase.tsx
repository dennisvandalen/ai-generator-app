import type {LoaderFunctionArgs, ActionFunctionArgs} from "@remix-run/node";

import {useLoaderData, useSubmit, useActionData} from "@remix-run/react";
import {useState, useEffect} from "react";
import {
  Page,
  Text,
  BlockStack,
  Card,
  Divider,
  Button,
  InlineStack,
  EmptyState,
  IndexTable,
  TextField,
  Banner,
  ButtonGroup,
  AppProvider,
  Icon,
  Tag, Box,
} from "@shopify/polaris";
import {
  PlusIcon,
  EditIcon,
  SettingsIcon,
  PackageIcon,
  VariantIcon,
  EyeCheckMarkIcon,
} from "@shopify/polaris-icons";
import {TitleBar, Modal, useAppBridge} from "@shopify/app-bridge-react";
import {authenticate} from "~/shopify.server";
import drizzleDb from "../db.server";
import {
  productBasesTable,
  productBaseVariantsTable,
  productProductBasesTable,
  productBaseOptionsTable,
  productBaseVariantOptionValuesTable,
  type ProductBase,
  type ProductBaseVariant,
  type NewProductBase,
  type NewProductBaseVariant,
  type ProductBaseOption,
  type NewProductBaseOption,
  type ProductBaseVariantOptionValue,
} from "~/db/schema";
import {eq, count} from "drizzle-orm";
import {getShopId} from "~/utils/getShopId";
import {randomUUID} from "crypto";

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  const shopId = getShopId(session.shop);

  // Fetch all product bases for this shop with their variants
  const productBases = await drizzleDb
    .select()
    .from(productBasesTable)
    .where(eq(productBasesTable.shopId, shopId))
    .orderBy(productBasesTable.sortOrder, productBasesTable.name);

  // Fetch all options for these product bases
  const productBaseOptions = await drizzleDb
    .select()
    .from(productBaseOptionsTable)
    .orderBy(productBaseOptionsTable.sortOrder);

  // Group options by product base ID
  const optionsByProductBase = new Map<number, ProductBaseOption[]>();
  productBaseOptions.forEach(option => {
    const baseId = option.productBaseId;
    if (!optionsByProductBase.has(baseId)) {
      optionsByProductBase.set(baseId, []);
    }
    optionsByProductBase.get(baseId)!.push(option);
  });

  // Fetch all variants for these product bases
  const productBaseVariants = await drizzleDb
    .select()
    .from(productBaseVariantsTable)
    .orderBy(productBaseVariantsTable.sortOrder, productBaseVariantsTable.name);

  // Group variants by product base ID
  const variantsByProductBase = new Map<number, ProductBaseVariant[]>();
  productBaseVariants.forEach(variant => {
    const baseId = variant.productBaseId;
    if (!variantsByProductBase.has(baseId)) {
      variantsByProductBase.set(baseId, []);
    }
    variantsByProductBase.get(baseId)!.push(variant);
  });

  // Fetch all option values for these variants
  const optionValues = await drizzleDb
    .select()
    .from(productBaseVariantOptionValuesTable);

  // Group option values by variant ID
  const optionValuesByVariant = new Map<number, ProductBaseVariantOptionValue[]>();
  optionValues.forEach(value => {
    const variantId = value.productBaseVariantId;
    if (!optionValuesByVariant.has(variantId)) {
      optionValuesByVariant.set(variantId, []);
    }
    optionValuesByVariant.get(variantId)!.push(value);
  });

  // Fetch the count of products using each product base
  const productCounts = await drizzleDb
    .select({
      productBaseId: productProductBasesTable.productBaseId,
      count: count(productProductBasesTable.productId),
    })
    .from(productProductBasesTable)
    .groupBy(productProductBasesTable.productBaseId);

  // Create a map of product base ID to product count
  const productCountByBaseId = new Map<number, number>();
  productCounts.forEach(item => {
    productCountByBaseId.set(item.productBaseId, item.count);
  });

  return Response.json({
    productBases,
    optionsByProductBase: Object.fromEntries(optionsByProductBase),
    variantsByProductBase: Object.fromEntries(variantsByProductBase),
    optionValuesByVariant: Object.fromEntries(optionValuesByVariant),
    productCountByBaseId: Object.fromEntries(productCountByBaseId),
    shopId,
  });
};

interface ActionData {
  success?: boolean;
  error?: string;
  message?: string;
}

export const action = async ({request}: ActionFunctionArgs): Promise<Response> => {
  const {session} = await authenticate.admin(request);
  const shopId = getShopId(session.shop);
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    if (action === "create_product_base") {
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const optionNames = formData.get("optionNames") as string;
      const basePrice = formData.get("basePrice") as string;

      if (!name) {
        const data: ActionData = {error: "Name is required"};
        return Response.json(data, {status: 400});
      }

      // Parse option names from comma-separated string
      const optionNamesArray = optionNames
        ? optionNames.split(',').map(name => name.trim()).filter(name => name)
        : [];

      const newProductBase: NewProductBase = {
        uuid: randomUUID(),
        shopId,
        name,
        description: description || null,
        basePrice: basePrice ? parseFloat(basePrice) : null,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Insert the product base first to get its ID
      const result = await drizzleDb.insert(productBasesTable).values(newProductBase);
      const productBaseId = result.lastInsertRowid as number;

      // Insert options into the options table
      if (optionNamesArray.length > 0) {
        const optionsToInsert: NewProductBaseOption[] = optionNamesArray.map((optionName, index) => ({
          productBaseId,
          name: optionName,
          sortOrder: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        await drizzleDb.insert(productBaseOptionsTable).values(optionsToInsert);
      }

      const data: ActionData = {
        success: true,
        message: `Product Base "${name}" created successfully`
      };
      return Response.json(data);
    }

    if (action === "edit_product_base") {
      const id = parseInt(formData.get("id") as string);
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const optionNames = formData.get("optionNames") as string;
      const basePrice = formData.get("basePrice") as string;
      const variantUpdates = formData.get("variantUpdates") as string;
      const variantDetailsUpdates = formData.get("variantDetailsUpdates") as string;

      if (!name) {
        const data: ActionData = {error: "Name is required"};
        return Response.json(data, {status: 400});
      }

      // Parse option names from comma-separated string
      const optionNamesArray = optionNames
        ? optionNames.split(',').map(name => name.trim()).filter(name => name)
        : [];

      // Update the product base
      await drizzleDb
        .update(productBasesTable)
        .set({
          name,
          description: description || null,
          basePrice: basePrice ? parseFloat(basePrice) : null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(productBasesTable.id, id));

      // Get existing options for this product base
      const existingOptions = await drizzleDb
        .select()
        .from(productBaseOptionsTable)
        .where(eq(productBaseOptionsTable.productBaseId, id));

      // Create a set of existing option names for quick lookup
      const existingOptionNames = new Set(existingOptions.map(option => option.name));

      // Determine which options to add, update, or delete
      const optionsToAdd: NewProductBaseOption[] = [];
      const optionsToKeep = new Set<string>();

      optionNamesArray.forEach((optionName, index) => {
        optionsToKeep.add(optionName);

        if (!existingOptionNames.has(optionName)) {
          // This is a new option, add it
          optionsToAdd.push({
            productBaseId: id,
            name: optionName,
            sortOrder: index,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          // This is an existing option, update its sort order if needed
          const existingOption = existingOptions.find(o => o.name === optionName);
          if (existingOption && existingOption.sortOrder !== index) {
            drizzleDb
              .update(productBaseOptionsTable)
              .set({ sortOrder: index, updatedAt: new Date().toISOString() })
              .where(eq(productBaseOptionsTable.id, existingOption.id))
              .execute();
          }
        }
      });

      // Add new options
      if (optionsToAdd.length > 0) {
        await drizzleDb.insert(productBaseOptionsTable).values(optionsToAdd);
      }

      // Delete options that are no longer needed
      for (const option of existingOptions) {
        if (!optionsToKeep.has(option.name)) {
          // Delete option values that reference this option
          await drizzleDb
            .delete(productBaseVariantOptionValuesTable)
            .where(eq(productBaseVariantOptionValuesTable.productBaseOptionId, option.id));

          // Delete the option itself
          await drizzleDb
            .delete(productBaseOptionsTable)
            .where(eq(productBaseOptionsTable.id, option.id));
        }
      }

      // Update variant option values if provided
      if (variantUpdates) {
        try {
          const updates = JSON.parse(variantUpdates);

          // Get all options for this product base (including newly added ones)
          const allOptions = await drizzleDb
            .select()
            .from(productBaseOptionsTable)
            .where(eq(productBaseOptionsTable.productBaseId, id));

          // Create a map of option name to option ID
          const optionNameToId = new Map<string, number>();
          allOptions.forEach(option => {
            optionNameToId.set(option.name, option.id);
          });

          for (const update of updates) {
            if (update.id && update.optionValues) {
              // Set optionValues to null in the variant table
              await drizzleDb
                .update(productBaseVariantsTable)
                .set({
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(productBaseVariantsTable.id, update.id));

              // Get existing option values for this variant
              const existingValues = await drizzleDb
                .select()
                .from(productBaseVariantOptionValuesTable)
                .where(eq(productBaseVariantOptionValuesTable.productBaseVariantId, update.id));

              // Create a map of option ID to existing value record
              const optionIdToValue = new Map<number, ProductBaseVariantOptionValue>();
              existingValues.forEach(value => {
                optionIdToValue.set(value.productBaseOptionId, value);
              });

              // Process each option value
              for (const [optionName, optionValue] of Object.entries(update.optionValues)) {
                const optionId = optionNameToId.get(optionName);

                if (optionId) {
                  const existingValue = optionIdToValue.get(optionId);

                  if (existingValue) {
                    // Update existing value
                    await drizzleDb
                      .update(productBaseVariantOptionValuesTable)
                      .set({
                        value: optionValue as string,
                        updatedAt: new Date().toISOString(),
                      })
                      .where(eq(productBaseVariantOptionValuesTable.id, existingValue.id));
                  } else {
                    // Insert new value
                    await drizzleDb
                      .insert(productBaseVariantOptionValuesTable)
                      .values({
                        productBaseVariantId: update.id,
                        productBaseOptionId: optionId,
                        value: optionValue as string,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      });
                  }
                }
              }

              // Delete values for options that are no longer present
              for (const existingValue of existingValues) {
                const optionName = allOptions.find(o => o.id === existingValue.productBaseOptionId)?.name;

                if (optionName && !(optionName in update.optionValues)) {
                  await drizzleDb
                    .delete(productBaseVariantOptionValuesTable)
                    .where(eq(productBaseVariantOptionValuesTable.id, existingValue.id));
                }
              }
            }
          }
        } catch (e) {
          console.error("Error updating variant options:", e);
          const data: ActionData = {error: "Error updating variant options"};
          return Response.json(data, {status: 400});
        }
      }

      // Update variant details if provided
      if (variantDetailsUpdates) {
        try {
          const detailsUpdates = JSON.parse(variantDetailsUpdates);
          for (const update of detailsUpdates) {
            if (update.id) {
              await drizzleDb
                .update(productBaseVariantsTable)
                .set({
                  name: update.name,
                  widthPx: update.widthPx,
                  heightPx: update.heightPx,
                  priceModifier: update.priceModifier,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(productBaseVariantsTable.id, update.id));
            }
          }
        } catch (e) {
          console.error("Error updating variant details:", e);
          const data: ActionData = {error: "Error updating variant details"};
          return Response.json(data, {status: 400});
        }
      }

      const data: ActionData = {
        success: true,
        message: `Product Base "${name}" and all variants updated successfully`
      };
      return Response.json(data);
    }

    if (action === "create_variant") {
      const productBaseId = parseInt(formData.get("productBaseId") as string);
      const name = formData.get("variantName") as string;
      const optionValuesData = formData.get("optionValues") as string;
      const widthPx = parseInt(formData.get("widthPx") as string);
      const heightPx = parseInt(formData.get("heightPx") as string);
      const priceModifier = formData.get("priceModifier") as string;

      if (!name || !widthPx || !heightPx) {
        const data: ActionData = {error: "Name, width, and height are required"};
        return Response.json(data, {status: 400});
      }

      let optionValues: Record<string, string> = {};
      try {
        optionValues = optionValuesData ? JSON.parse(optionValuesData) : {};
      } catch (e) {
        console.error("Error parsing option values:", e);
        const data: ActionData = {error: "Invalid option values format"};
        return Response.json(data, {status: 400});
      }

      const newVariant: NewProductBaseVariant = {
        uuid: randomUUID(),
        productBaseId,
        name,
        optionValues: null, // No longer storing option values as JSON
        widthPx,
        heightPx,
        priceModifier: priceModifier ? parseFloat(priceModifier) : 0,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Insert the variant first to get its ID
      const result = await drizzleDb.insert(productBaseVariantsTable).values(newVariant);
      const variantId = result.lastInsertRowid as number;

      // Get all options for this product base
      const options = await drizzleDb
        .select()
        .from(productBaseOptionsTable)
        .where(eq(productBaseOptionsTable.productBaseId, productBaseId));

      // Insert option values
      if (Object.keys(optionValues).length > 0) {
        for (const option of options) {
          const value = optionValues[option.name];

          if (value !== undefined) {
            await drizzleDb.insert(productBaseVariantOptionValuesTable).values({
              productBaseVariantId: variantId,
              productBaseOptionId: option.id,
              value,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      const data: ActionData = {
        success: true,
        message: `Variant "${name}" added successfully`
      };
      return Response.json(data);
    }

    if (action === "edit_variant") {
      const id = parseInt(formData.get("id") as string);
      const name = formData.get("variantName") as string;
      const optionValuesData = formData.get("optionValues") as string;
      const widthPx = parseInt(formData.get("widthPx") as string);
      const heightPx = parseInt(formData.get("heightPx") as string);
      const priceModifier = formData.get("priceModifier") as string;

      if (!name || !widthPx || !heightPx) {
        const data: ActionData = {error: "Name, width, and height are required"};
        return Response.json(data, {status: 400});
      }

      let optionValues: Record<string, string> = {};
      try {
        optionValues = optionValuesData ? JSON.parse(optionValuesData) : {};
      } catch (e) {
        console.error("Error parsing option values:", e);
        const data: ActionData = {error: "Invalid option values format"};
        return Response.json(data, {status: 400});
      }

      // Get the variant to find its product base ID
      const variant = await drizzleDb
        .select()
        .from(productBaseVariantsTable)
        .where(eq(productBaseVariantsTable.id, id))
        .limit(1);

      if (variant.length === 0) {
        const data: ActionData = {error: "Variant not found"};
        return Response.json(data, {status: 404});
      }

      const productBaseId = variant[0].productBaseId;

      // Update the variant
      await drizzleDb
        .update(productBaseVariantsTable)
        .set({
          name,
          widthPx,
          heightPx,
          priceModifier: priceModifier ? parseFloat(priceModifier) : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(productBaseVariantsTable.id, id));

      // Get all options for this product base
      const options = await drizzleDb
        .select()
        .from(productBaseOptionsTable)
        .where(eq(productBaseOptionsTable.productBaseId, productBaseId));

      // Get existing option values for this variant
      const existingValues = await drizzleDb
        .select()
        .from(productBaseVariantOptionValuesTable)
        .where(eq(productBaseVariantOptionValuesTable.productBaseVariantId, id));

      // Create a map of option ID to existing value record
      const optionIdToValue = new Map<number, ProductBaseVariantOptionValue>();
      existingValues.forEach(value => {
        optionIdToValue.set(value.productBaseOptionId, value);
      });

      // Process each option value
      for (const option of options) {
        const value = optionValues[option.name];
        const existingValue = optionIdToValue.get(option.id);

        if (value !== undefined) {
          if (existingValue) {
            // Update existing value
            await drizzleDb
              .update(productBaseVariantOptionValuesTable)
              .set({
                value,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(productBaseVariantOptionValuesTable.id, existingValue.id));
          } else {
            // Insert new value
            await drizzleDb
              .insert(productBaseVariantOptionValuesTable)
              .values({
                productBaseVariantId: id,
                productBaseOptionId: option.id,
                value,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
          }
        } else if (existingValue) {
          // Delete value if it exists but is not in the new values
          await drizzleDb
            .delete(productBaseVariantOptionValuesTable)
            .where(eq(productBaseVariantOptionValuesTable.id, existingValue.id));
        }
      }

      const data: ActionData = {
        success: true,
        message: `Variant "${name}" updated successfully`
      };
      return Response.json(data);
    }

    if (action === "delete_product_base") {
      const id = parseInt(formData.get("id") as string);

      // Check if the product base has any associated products
      const productCount = await drizzleDb
        .select({
          count: count(productProductBasesTable.productId),
        })
        .from(productProductBasesTable)
        .where(eq(productProductBasesTable.productBaseId, id));

      if (productCount[0].count > 0) {
        const data: ActionData = {
          error: "Cannot delete product base that is being used by products"
        };
        return Response.json(data, {status: 400});
      }

      // Get the product base name for the success message
      const productBase = await drizzleDb
        .select({
          name: productBasesTable.name,
        })
        .from(productBasesTable)
        .where(eq(productBasesTable.id, id))
        .limit(1);

      if (!productBase.length) {
        const data: ActionData = {error: "Product base not found"};
        return Response.json(data, {status: 404});
      }

      // Delete all variants of this product base
      await drizzleDb
        .delete(productBaseVariantsTable)
        .where(eq(productBaseVariantsTable.productBaseId, id));

      // Delete the product base
      await drizzleDb
        .delete(productBasesTable)
        .where(eq(productBasesTable.id, id));

      const data: ActionData = {
        success: true,
        message: `Product Base "${productBase[0].name}" deleted successfully`
      };
      return Response.json(data);
    }

    const data: ActionData = {error: "Invalid action"};
    return Response.json(data, {status: 400});
  } catch (error) {
    console.error("Error in productbase action:", error);
    const data: ActionData = {error: "An error occurred. Please try again."};
    return Response.json(data, {status: 500});
  }
};

export default function ProductbasePage() {
  const {productBases, optionsByProductBase, variantsByProductBase, optionValuesByVariant, productCountByBaseId} = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const shopify = useAppBridge();

  const [selectedProductBaseId, setSelectedProductBaseId] = useState<number | null>(null);
  const [selectedProductBase, setSelectedProductBase] = useState<ProductBase | null>(null);

  const [variantOptionValues, setVariantOptionValues] = useState<Record<string, string>>({});

  // Form state for creating product base
  const [productBaseName, setProductBaseName] = useState("");
  const [productBaseDescription, setProductBaseDescription] = useState("");
  const [productBaseOptionNames, setProductBaseOptionNames] = useState("");
  const [productBasePrice, setProductBasePrice] = useState("");

  // Form state for editing product base
  const [editProductBaseName, setEditProductBaseName] = useState("");
  const [editProductBaseDescription, setEditProductBaseDescription] = useState("");
  const [editProductBaseOptionNames, setEditProductBaseOptionNames] = useState("");
  const [editProductBasePrice, setEditProductBasePrice] = useState("");
  const [editVariantsOptionValues, setEditVariantsOptionValues] = useState<Record<number, Record<string, string>>>({});
  const [editVariantsDetails, setEditVariantsDetails] = useState<Record<number, {
    name: string;
    widthPx: string;
    heightPx: string;
    priceModifier: string
  }>>({});

  // Form state for creating variant
  const [variantName, setVariantName] = useState("");
  const [variantWidth, setVariantWidth] = useState("");
  const [variantHeight, setVariantHeight] = useState("");
  const [variantPriceModifier, setVariantPriceModifier] = useState("");

  // Handle success toasts
  useEffect(() => {
    if (actionData?.success && actionData?.message && typeof shopify?.toast?.show === 'function') {
      shopify.toast.show(actionData.message, {duration: 3000});
    }
  }, [actionData]);

  const handleCreateProductBase = () => {
    const formData = new FormData();
    formData.append("action", "create_product_base");
    formData.append("name", productBaseName);
    formData.append("description", productBaseDescription);
    formData.append("optionNames", productBaseOptionNames);
    formData.append("basePrice", productBasePrice);

    submit(formData, {method: "post"});
    shopify.modal.hide('create-product-base-modal');

    // Reset form
    setProductBaseName("");
    setProductBaseDescription("");
    setProductBaseOptionNames("");
    setProductBasePrice("");
  };

  const handleEditProductBase = () => {
    if (!selectedProductBase) return;

    const formData = new FormData();
    formData.append("action", "edit_product_base");
    formData.append("id", selectedProductBase.id.toString());
    formData.append("name", editProductBaseName);
    formData.append("description", editProductBaseDescription);
    formData.append("optionNames", editProductBaseOptionNames);
    formData.append("basePrice", editProductBasePrice);

    // Prepare variant option values updates
    const variants = variantsByProductBase[selectedProductBase.id] || [];
    const variantUpdates = variants.map(variant => ({
      id: variant.id,
      optionValues: editVariantsOptionValues[variant.id] || {}
    }));
    formData.append("variantUpdates", JSON.stringify(variantUpdates));

    // Prepare variant details updates
    const variantDetailsUpdates = variants.map(variant => ({
      id: variant.id,
      name: editVariantsDetails[variant.id]?.name || variant.name,
      widthPx: parseInt(editVariantsDetails[variant.id]?.widthPx || variant.widthPx.toString()),
      heightPx: parseInt(editVariantsDetails[variant.id]?.heightPx || variant.heightPx.toString()),
      priceModifier: parseFloat(editVariantsDetails[variant.id]?.priceModifier || variant.priceModifier?.toString() || "0")
    }));
    formData.append("variantDetailsUpdates", JSON.stringify(variantDetailsUpdates));

    submit(formData, {method: "post"});
    shopify.modal.hide('edit-product-base-modal');

    // Reset form
    setEditProductBaseName("");
    setEditProductBaseDescription("");
    setEditProductBaseOptionNames("");
    setEditProductBasePrice("");
    setEditVariantsOptionValues({});
    setEditVariantsDetails({});
    setSelectedProductBase(null);
  };

  const handleCreateVariant = () => {
    if (!selectedProductBaseId) return;

    const formData = new FormData();
    formData.append("action", "create_variant");
    formData.append("productBaseId", selectedProductBaseId.toString());
    formData.append("variantName", variantName);
    formData.append("optionValues", JSON.stringify(variantOptionValues));
    formData.append("widthPx", variantWidth);
    formData.append("heightPx", variantHeight);
    formData.append("priceModifier", variantPriceModifier);

    submit(formData, {method: "post"});
    shopify.modal.hide('create-variant-modal');

    // Reset form
    setVariantName("");
    setVariantOptionValues({});
    setVariantWidth("");
    setVariantHeight("");
    setVariantPriceModifier("");
    setSelectedProductBaseId(null);
    setSelectedProductBase(null);
  };

  const openEditModal = (productBase: ProductBase) => {
    setSelectedProductBase(productBase);
    setEditProductBaseName(productBase.name);
    setEditProductBaseDescription(productBase.description || "");

    // Get options from the database and convert to comma-separated string
    const options = optionsByProductBase[productBase.id] || [];
    const optionNames = options.map(option => option.name);
    setEditProductBaseOptionNames(optionNames.join(", "));
    setEditProductBasePrice(productBase.basePrice?.toString() || "");

    // Initialize variant option values
    const variants = variantsByProductBase[productBase.id] || [];
    const initialVariantValues: Record<number, Record<string, string>> = {};
    const initialVariantDetails: Record<number, {
      name: string;
      widthPx: string;
      heightPx: string;
      priceModifier: string
    }> = {};

    variants.forEach(variant => {
      // Option values from the database
      const variantValues: Record<string, string> = {};
      const variantOptionValues = optionValuesByVariant[variant.id] || [];

      // Create a map of option name to value
      options.forEach(option => {
        const optionValue = variantOptionValues.find(value => value.productBaseOptionId === option.id);
        variantValues[option.name] = optionValue?.value || "";
      });

      initialVariantValues[variant.id] = variantValues;

      // Variant details
      initialVariantDetails[variant.id] = {
        name: variant.name,
        widthPx: variant.widthPx.toString(),
        heightPx: variant.heightPx.toString(),
        priceModifier: variant.priceModifier?.toString() || "0"
      };
    });

    setEditVariantsOptionValues(initialVariantValues);
    setEditVariantsDetails(initialVariantDetails);
    shopify.modal.show('edit-product-base-modal');
  };

  const openVariantModal = (productBaseId: number) => {
    const productBase = productBases.find(base => base.id === productBaseId);
    setSelectedProductBaseId(productBaseId);
    setSelectedProductBase(productBase || null);

    // Initialize option values object using options from the database
    const options = optionsByProductBase[productBaseId] || [];
    if (options.length > 0) {
      const initialValues: Record<string, string> = {};
      options.forEach(option => {
        initialValues[option.name] = "";
      });
      setVariantOptionValues(initialValues);
    } else {
      setVariantOptionValues({});
    }

    shopify.modal.show('create-variant-modal');
  };

  return (
    <Page title="Product Bases"
          subtitle="Manage foundational products for your AI-generated designs"
          primaryAction={{
            content: 'Create Product Base',
            icon: PlusIcon,
            onAction: () => shopify.modal.show('create-product-base-modal'),
          }}
    >
      <TitleBar title="Product Bases">
        <button
          variant="primary"
          onClick={() => shopify.modal.show('create-product-base-modal')}
        >
          Create Product Base
        </button>
      </TitleBar>
      <BlockStack gap="400">
        {actionData?.error && (
          <Banner tone="critical" onDismiss={() => {
          }}>
            <p>{actionData.error}</p>
          </Banner>
        )}

        {/* Quick stats */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Overview
            </Text>
            <InlineStack gap="400" wrap>
              <Card>
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <Box>
                      <Icon source={PackageIcon} tone="base"/>
                    </Box>
                    <Text variant="headingMd" as="h3">
                      {productBases.length}
                    </Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued" as="span">Total Bases</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <Box>
                      <Icon source={VariantIcon} tone="base"/>
                    </Box>
                    <Text variant="headingMd" as="h3">
                      {Object.values(variantsByProductBase).reduce((sum, variants) => sum + variants.length, 0)}
                    </Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued" as="span">Total Variants</Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <Box>
                      <Icon source={EyeCheckMarkIcon} tone="success"/>
                    </Box>
                    <Text variant="headingMd" as="h3">
                      {productBases.filter(base => base.isActive).length}
                    </Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued" as="span">Active Bases</Text>
                </BlockStack>
              </Card>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Main content */}
        <Card>
          {productBases.length === 0 ? (
            <EmptyState
              heading="No product bases created yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Create your first product base to start building templates for your AI-generated products.</p>
              <Button
                variant="primary"
                icon={PlusIcon}
                onClick={() => shopify.modal.show('create-product-base-modal')}
              >
                Create Product Base
              </Button>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{singular: 'product base', plural: 'product bases'}}
              itemCount={productBases.length}
              headings={[
                {title: 'Product Base'},
                {title: 'Options'},
                {title: 'Variants'},
                {title: 'Products Using'},
                {title: 'Actions'},
              ]}
              selectable={false}
            >
              {productBases.map((base: ProductBase, index: number) => {
                const variants = variantsByProductBase[base.id] || [];
                return (
                  <IndexTable.Row id={base.id.toString()} key={base.id} position={index}>
                    <IndexTable.Cell>
                      <BlockStack gap="100">
                        <InlineStack gap="200" align="start">
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold" as="span">
                              {base.name}
                            </Text>
                            {base.description && (
                              <Text variant="bodySm" tone="subdued" as="span">
                                {base.description}
                              </Text>
                            )}
                            {base.basePrice && (
                              <Text variant="bodySm" tone="subdued" as="span">
                                ${base.basePrice}
                              </Text>
                            )}
                          </BlockStack>
                        </InlineStack>
                      </BlockStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {optionsByProductBase[base.id]?.length > 0 ? (
                        <InlineStack gap="200" wrap>
                          {optionsByProductBase[base.id].map((option) => (
                            <Tag key={option.id}>
                              {option.name}
                            </Tag>
                          ))}
                        </InlineStack>
                      ) : (
                        <Text variant="bodyMd" tone="subdued" as="span">
                          No options
                        </Text>
                      )}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" as="span">
                        {variants.length} variant{variants.length !== 1 ? 's' : ''}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" as="span">
                        {productCountByBaseId[base.id] || 0}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <ButtonGroup>
                        <Button
                          size="slim"
                          icon={EditIcon}
                          onClick={() => openEditModal(base)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="slim"
                          icon={PlusIcon}
                          onClick={() => openVariantModal(base.id)}
                        >
                          Add Variant
                        </Button>
                        {(productCountByBaseId[base.id] || 0) === 0 && (
                          <Button
                            size="slim"
                            tone="critical"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${base.name}"?`)) {
                                const formData = new FormData();
                                formData.append("action", "delete_product_base");
                                formData.append("id", base.id.toString());
                                submit(formData, {method: "post"});
                              }
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </ButtonGroup>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          )}
        </Card>

        {/* Info Cards - More compact and action-oriented */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              About Product Bases
            </Text>

            <InlineStack gap="500" align="start" wrap>
              <div style={{flex: '1 1 30%', minWidth: '250px'}}>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="start">
                      <Box>
                        <Icon source={PackageIcon} tone="base"/>
                      </Box>
                      <Text variant="headingSm" as="h3">What are Product Bases?</Text>
                    </InlineStack>
                    <Text variant="bodySm" as="p">
                      A foundational, configurable product template for AI-generated designs. Product bases define the core characteristics of physical products (e.g., posters, canvas prints, mugs) onto which AI-generated artwork will be applied.
                    </Text>
                  </BlockStack>
                </Card>
              </div>

              <div style={{flex: '1 1 30%', minWidth: '250px'}}>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="center">
                      <Box>
                        <Icon source={EyeCheckMarkIcon} tone="success"/>
                      </Box>
                      <Text variant="headingSm" as="h3">Fast Setup</Text>
                    </InlineStack>
                    <Text variant="bodySm" as="p">
                      Instantly apply any design to a Product Base—no need to manually configure variants each time. Standardizes product dimensions, material properties, pricing, and ensures accurate previews.
                    </Text>
                  </BlockStack>
                </Card>
              </div>

              <div style={{flex: '1 1 30%', minWidth: '250px'}}>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack gap="200" align="center">
                      <Box>
                        <Icon source={SettingsIcon} tone="base"/>
                      </Box>
                      <Text variant="headingSm" as="h3">Reliability</Text>
                    </InlineStack>
                    <Text variant="bodySm" as="p">
                      All print and variant details are pre-configured, ensuring correct fulfillment and presentation. Each variant explicitly defines its corresponding pixel dimensions for optimal AI generation.
                    </Text>
                  </BlockStack>
                </Card>
              </div>
            </InlineStack>

            <Divider />
            <Text variant="headingSm" as="h3">Key Components & Functionality</Text>

            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h4">Product Base Definition</Text>
                  <Text variant="bodySm" as="p">
                    Product bases provide standardized templates for AI-generated art, defining the physical product type (e.g., "Poster," "Canvas," "T-Shirt"). Core attributes include predefined dimensions (e.g., 1:1 for square, 2:3 for portrait) and base pricing structure that can be adjusted by variants.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h4">Variant Management</Text>
                  <Text variant="bodySm" as="p">
                    Each product base can have multiple variants for different sizes or options. For example, a Poster product base might have variants like A4 (210mm x 297mm), A3 (297mm x 420mm), or Custom Square (30x30cm). Each variant explicitly defines its pixel dimensions (e.g., A4 might be 2480x3508px at 300 DPI).
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h4">Product-Product Base Relationship</Text>
                  <Text variant="bodySm" as="p">
                    A Shopify Product can be linked to one or more Product Bases. A Shopify Product Variant can be linked to exactly one Product Base Variant, ensuring that each specific product offering (e.g., "My AI Art - A4 Poster") corresponds to a defined physical template.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h4">AI Generation Integration</Text>
                  <Text variant="bodySm" as="p">
                    When a user selects a product variant and triggers AI generation, the system retrieves the specific dimensions associated with that variant. All relevant details, including product IDs and selected style, are passed to the AI generation service to produce an image optimized for that output size.
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>

      {/* Create Product Base Modal */}
      <Modal id="create-product-base-modal" variant="large">
        <AppProvider i18n={{}}>
          <div style={{padding: '1.5rem'}}>
            <BlockStack gap="400">
              <TextField
                label="Name"
                value={productBaseName}
                onChange={setProductBaseName}
                placeholder="e.g., Ceramic Mug, Classic T-Shirt"
                autoComplete="off"
              />

              <TextField
                label="Description (optional)"
                value={productBaseDescription}
                onChange={setProductBaseDescription}
                placeholder="Brief description of this product base"
                multiline={2}
                autoComplete="off"
              />

              <TextField
                label="Option Names (optional)"
                value={productBaseOptionNames}
                onChange={setProductBaseOptionNames}
                placeholder="e.g., Size, Color, Material"
                helpText="Enter option names separated by commas"
                autoComplete="off"
              />

              <TextField
                label="Base Price (optional)"
                value={productBasePrice}
                onChange={setProductBasePrice}
                placeholder="0.00"
                type="number"
                prefix="$"
                autoComplete="off"
              />
            </BlockStack>
          </div>
        </AppProvider>

        <TitleBar title="Create Product Base">
          <button
            variant="primary"
            onClick={handleCreateProductBase}
            disabled={!productBaseName}
          >
            Create
          </button>
          <button onClick={() => shopify.modal.hide('create-product-base-modal')}>
            Cancel
          </button>
        </TitleBar>
      </Modal>

      {/* Edit Product Base Modal */}
      <Modal id="edit-product-base-modal" variant="large">
        <AppProvider i18n={{}}>
          <div style={{padding: '1.5rem'}}>
            <BlockStack gap="600">
              <Text variant="headingMd" as="h3">Product Base Details</Text>
              <BlockStack gap="400">
                <TextField
                  label="Name"
                  value={editProductBaseName}
                  onChange={setEditProductBaseName}
                  placeholder="e.g., Ceramic Mug, Classic T-Shirt"
                  autoComplete="off"
                />

                <TextField
                  label="Description (optional)"
                  value={editProductBaseDescription}
                  onChange={setEditProductBaseDescription}
                  placeholder="Brief description of this product base"
                  multiline={2}
                  autoComplete="off"
                />

                <TextField
                  label="Option Names (optional)"
                  value={editProductBaseOptionNames}
                  onChange={(value) => {
                    setEditProductBaseOptionNames(value);

                    // Update variant option values when option names change
                    if (selectedProductBase) {
                      const newOptionNames = value.split(',').map(name => name.trim()).filter(name => name);
                      const variants = variantsByProductBase[selectedProductBase.id] || [];
                      const updatedVariantValues: Record<number, Record<string, string>> = {};

                      variants.forEach(variant => {
                        const existingValues = editVariantsOptionValues[variant.id] || {};
                        const newValues: Record<string, string> = {};

                        newOptionNames.forEach(optionName => {
                          newValues[optionName] = existingValues[optionName] || "";
                        });

                        updatedVariantValues[variant.id] = newValues;
                      });

                      setEditVariantsOptionValues(updatedVariantValues);
                    }
                  }}
                  placeholder="e.g., Size, Color, Material"
                  helpText="Enter option names separated by commas. Changing this will update all variants below."
                  autoComplete="off"
                />

                <TextField
                  label="Base Price (optional)"
                  value={editProductBasePrice}
                  onChange={setEditProductBasePrice}
                  placeholder="0.00"
                  type="number"
                  prefix="$"
                  autoComplete="off"
                />
              </BlockStack>

              {/* Variants Section */}
              {selectedProductBase && variantsByProductBase[selectedProductBase.id] && variantsByProductBase[selectedProductBase.id].length > 0 && (
                <>
                  <Divider/>
                  <Text variant="headingMd" as="h3">Variants</Text>

                  <BlockStack gap="500">
                    {variantsByProductBase[selectedProductBase.id].map((variant: ProductBaseVariant) => {
                      return (
                        <Card key={variant.id}>
                          <BlockStack gap="500">
                            <Text variant="headingSm" as="h4">
                              Variant: {variant.name}
                            </Text>

                            {/* Variant Details */}
                            <BlockStack gap="400">
                              <Text variant="bodyMd" fontWeight="semibold" as="p">Variant Details</Text>

                              <TextField
                                label="Variant Name"
                                value={editVariantsDetails[variant.id]?.name || variant.name}
                                onChange={(value) => {
                                  setEditVariantsDetails(prev => ({
                                    ...prev,
                                    [variant.id]: {
                                      ...prev[variant.id],
                                      name: value,
                                      widthPx: prev[variant.id]?.widthPx || variant.widthPx.toString(),
                                      heightPx: prev[variant.id]?.heightPx || variant.heightPx.toString(),
                                      priceModifier: prev[variant.id]?.priceModifier || variant.priceModifier?.toString() || "0"
                                    }
                                  }));
                                }}
                                placeholder="e.g., White, Large, A4"
                                autoComplete="off"
                              />

                              <InlineStack gap="300">
                                <TextField
                                  label="Width (pixels)"
                                  value={editVariantsDetails[variant.id]?.widthPx || variant.widthPx.toString()}
                                  onChange={(value) => {
                                    setEditVariantsDetails(prev => ({
                                      ...prev,
                                      [variant.id]: {
                                        ...prev[variant.id],
                                        name: prev[variant.id]?.name || variant.name,
                                        widthPx: value,
                                        heightPx: prev[variant.id]?.heightPx || variant.heightPx.toString(),
                                        priceModifier: prev[variant.id]?.priceModifier || variant.priceModifier?.toString() || "0"
                                      }
                                    }));
                                  }}
                                  placeholder="2000"
                                  type="number"
                                  autoComplete="off"
                                />

                                <TextField
                                  label="Height (pixels)"
                                  value={editVariantsDetails[variant.id]?.heightPx || variant.heightPx.toString()}
                                  onChange={(value) => {
                                    setEditVariantsDetails(prev => ({
                                      ...prev,
                                      [variant.id]: {
                                        ...prev[variant.id],
                                        name: prev[variant.id]?.name || variant.name,
                                        widthPx: prev[variant.id]?.widthPx || variant.widthPx.toString(),
                                        heightPx: value,
                                        priceModifier: prev[variant.id]?.priceModifier || variant.priceModifier?.toString() || "0"
                                      }
                                    }));
                                  }}
                                  placeholder="2000"
                                  type="number"
                                  autoComplete="off"
                                />
                              </InlineStack>

                              <TextField
                                label="Price Modifier (optional)"
                                value={editVariantsDetails[variant.id]?.priceModifier || variant.priceModifier?.toString() || "0"}
                                onChange={(value) => {
                                  setEditVariantsDetails(prev => ({
                                    ...prev,
                                    [variant.id]: {
                                      ...prev[variant.id],
                                      name: prev[variant.id]?.name || variant.name,
                                      widthPx: prev[variant.id]?.widthPx || variant.widthPx.toString(),
                                      heightPx: prev[variant.id]?.heightPx || variant.heightPx.toString(),
                                      priceModifier: value
                                    }
                                  }));
                                }}
                                placeholder="0.00"
                                type="number"
                                prefix="$"
                                helpText="Additional cost for this variant (can be negative)"
                                autoComplete="off"
                              />
                            </BlockStack>

                            {/* Option Values */}
                            {selectedProductBase && optionsByProductBase[selectedProductBase.id]?.length > 0 && (
                              <>
                                <Divider/>
                                <BlockStack gap="400">
                                  <Text variant="bodyMd" fontWeight="semibold" as="p">Option Values</Text>
                                  <InlineStack gap="300" wrap>
                                    {optionsByProductBase[selectedProductBase.id].map((option) => (
                                      <div key={`${variant.id}-${option.name}`} style={{minWidth: '200px'}}>
                                        <TextField
                                          label={option.name}
                                          value={editVariantsOptionValues[variant.id]?.[option.name] || ""}
                                          onChange={(value) => {
                                            setEditVariantsOptionValues(prev => ({
                                              ...prev,
                                              [variant.id]: {
                                                ...prev[variant.id],
                                                [option.name]: value
                                              }
                                            }));
                                          }}
                                          placeholder={`Enter ${option.name.toLowerCase()}`}
                                          autoComplete="off"
                                        />
                                      </div>
                                    ))}
                                  </InlineStack>
                                </BlockStack>
                              </>
                            )}
                          </BlockStack>
                        </Card>
                      );
                    })}
                  </BlockStack>
                </>
              )}
            </BlockStack>
          </div>
        </AppProvider>
        <TitleBar title="Edit Product Base">
          <button
            variant="primary"
            onClick={handleEditProductBase}
            disabled={!editProductBaseName}
          >
            Save All Changes
          </button>
          <button onClick={() => shopify.modal.hide('edit-product-base-modal')}>
            Cancel
          </button>
        </TitleBar>
      </Modal>

      {/* Create Variant Modal */}
      <Modal id="create-variant-modal" variant="large">
        <AppProvider i18n={{}}>
          <div style={{padding: '1.5rem'}}>
            <BlockStack gap="400">
              <TextField
                label="Variant Name"
                value={variantName}
                onChange={setVariantName}
                placeholder="e.g., White, Large, A4"
                autoComplete="off"
              />

              {/* Dynamic option value fields */}
              {selectedProductBaseId && optionsByProductBase[selectedProductBaseId]?.map((option) => (
                <TextField
                  key={option.id}
                  label={option.name}
                  value={variantOptionValues[option.name] || ""}
                  onChange={(value) => setVariantOptionValues(prev => ({
                    ...prev,
                    [option.name]: value
                  }))}
                  placeholder={`Enter ${option.name.toLowerCase()}`}
                  autoComplete="off"
                />
              ))}

              <InlineStack gap="300">
                <TextField
                  label="Width (pixels)"
                  value={variantWidth}
                  onChange={setVariantWidth}
                  placeholder="2000"
                  type="number"
                  autoComplete="off"
                />

                <TextField
                  label="Height (pixels)"
                  value={variantHeight}
                  onChange={setVariantHeight}
                  placeholder="2000"
                  type="number"
                  autoComplete="off"
                />
              </InlineStack>

              <TextField
                label="Price Modifier (optional)"
                value={variantPriceModifier}
                onChange={setVariantPriceModifier}
                placeholder="0.00"
                type="number"
                prefix="$"
                helpText="Additional cost for this variant (can be negative)"
                autoComplete="off"
              />
            </BlockStack>
          </div>
        </AppProvider>
        <TitleBar title="Add Product Base Variant">
          <button
            variant="primary"
            onClick={handleCreateVariant}
            disabled={!variantName || !variantWidth || !variantHeight}
          >
            Add Variant
          </button>
          <button onClick={() => shopify.modal.hide('create-variant-modal')}>
            Cancel
          </button>
        </TitleBar>
      </Modal>
    </Page>
  );
}
