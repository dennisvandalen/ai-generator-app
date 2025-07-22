import drizzleDb from "../app/db.server";
import { productBasesTable, productBaseVariantsTable, type NewProductBase, type NewProductBaseVariant } from "../app/db/schema";
import { randomUUID } from "crypto";

async function seedProductBases() {
  const shopId = "example-shop.myshopify.com"; // Replace with actual shop ID
  const timestamp = new Date().toISOString();

  // Product Bases to create
  const productBasesData: NewProductBase[] = [
    {
      uuid: randomUUID(),
      shopId,
      name: "Ceramic Mug",
      description: "High-quality ceramic mug perfect for custom designs",
      optionNames: JSON.stringify(["Color"]),
      basePrice: 15.99,
      isActive: true,
      sortOrder: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      uuid: randomUUID(),
      shopId,
      name: "Classic T-Shirt",
      description: "Premium cotton t-shirt for custom prints",
      optionNames: JSON.stringify(["Size"]),
      basePrice: 19.99,
      isActive: true,
      sortOrder: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      uuid: randomUUID(),
      shopId,
      name: "Canvas Print",
      description: "Museum-quality canvas prints",
      optionNames: JSON.stringify(["Size"]),
      basePrice: 29.99,
      isActive: true,
      sortOrder: 3,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  // Insert product bases
  const insertedBases = await drizzleDb.insert(productBasesTable).values(productBasesData).returning();
  console.log(`Created ${insertedBases.length} product bases`);

  // Create variants for each product base
  const variantsData: NewProductBaseVariant[] = [];

  // Ceramic Mug variants
  const mugBase = insertedBases.find(base => base.name === "Ceramic Mug");
  if (mugBase) {
    variantsData.push(
      {
        uuid: randomUUID(),
        productBaseId: mugBase.id,
        name: "White",
        optionValues: JSON.stringify({"Color": "White"}),
        widthPx: 2000,
        heightPx: 2000,
        priceModifier: 0,
        isActive: true,
        sortOrder: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        uuid: randomUUID(),
        productBaseId: mugBase.id,
        name: "Black",
        optionValues: JSON.stringify({"Color": "Black"}),
        widthPx: 2000,
        heightPx: 2000,
        priceModifier: 2.00,
        isActive: true,
        sortOrder: 2,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        uuid: randomUUID(),
        productBaseId: mugBase.id,
        name: "Red",
        optionValues: JSON.stringify({"Color": "Red"}),
        widthPx: 2000,
        heightPx: 2000,
        priceModifier: 1.50,
        isActive: true,
        sortOrder: 3,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    );
  }

  // T-Shirt variants
  const tshirtBase = insertedBases.find(base => base.name === "Classic T-Shirt");
  if (tshirtBase) {
    const sizes = [
      { name: "S", modifier: 0 },
      { name: "M", modifier: 0 },
      { name: "L", modifier: 2.00 },
      { name: "XL", modifier: 4.00 },
    ];
    
    sizes.forEach((size, index) => {
      variantsData.push({
        uuid: randomUUID(),
        productBaseId: tshirtBase.id,
        name: size.name,
        optionValues: JSON.stringify({"Size": size.name}),
        widthPx: 3000,
        heightPx: 4000,
        priceModifier: size.modifier,
        isActive: true,
        sortOrder: index + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  // Canvas Print variants
  const canvasBase = insertedBases.find(base => base.name === "Canvas Print");
  if (canvasBase) {
    variantsData.push(
      {
        uuid: randomUUID(),
        productBaseId: canvasBase.id,
        name: "12x16",
        optionValues: JSON.stringify({"Size": "12x16"}),
        widthPx: 3600,
        heightPx: 4800,
        priceModifier: 0,
        isActive: true,
        sortOrder: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        uuid: randomUUID(),
        productBaseId: canvasBase.id,
        name: "16x20",
        optionValues: JSON.stringify({"Size": "16x20"}),
        widthPx: 4800,
        heightPx: 6000,
        priceModifier: 10.00,
        isActive: true,
        sortOrder: 2,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        uuid: randomUUID(),
        productBaseId: canvasBase.id,
        name: "20x24",
        optionValues: JSON.stringify({"Size": "20x24"}),
        widthPx: 6000,
        heightPx: 7200,
        priceModifier: 20.00,
        isActive: true,
        sortOrder: 3,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    );
  }

  // Insert variants
  if (variantsData.length > 0) {
    const insertedVariants = await drizzleDb.insert(productBaseVariantsTable).values(variantsData).returning();
    console.log(`Created ${insertedVariants.length} product base variants`);
  }

  console.log("Product base seeding completed!");
}

// Run the seeding
seedProductBases().catch(console.error); 