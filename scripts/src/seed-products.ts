import { db, productsTable } from "@workspace/db";

const products = [
  {
    name: "Chicken Eggs",
    description:
      "Fresh eggs from our pastured chickens, raised on 70 acres of rotated pasture. Our hens are moved regularly so they're always foraging on fresh ground. Non-GMO feed.",
    productType: "eggs_chicken" as const,
    pricingType: "unit" as const,
    priceInCents: 700,
    unitLabel: "dozen",
    depositDescription: null,
    availability: "taking_orders" as const,
    imageUrl: null,
    displayOrder: 1,
  },
  {
    name: "Duck Eggs",
    description:
      "Rich, creamy duck eggs from our Pekin and Khaki Campbell ducks. Duck eggs are prized for baking — larger yolks, more fat, and a richer flavor than chicken eggs. Non-GMO feed.",
    productType: "eggs_duck" as const,
    pricingType: "unit" as const,
    priceInCents: 600,
    unitLabel: "half-dozen",
    depositDescription: null,
    availability: "taking_orders" as const,
    imageUrl: null,
    displayOrder: 2,
  },
  {
    name: "Pastured Chicken",
    description:
      "Whole, half, or cut-up pastured chickens raised on 70 acres. Available as whole bird (frozen), half bird (frozen), or entire bird cut up and frozen. Final price is by the pound — deposit reserves your spot in the next batch.",
    productType: "meat_chicken" as const,
    pricingType: "deposit" as const,
    priceInCents: 2500,
    unitLabel: null,
    depositDescription:
      "Your $25 deposit reserves your chicken in our next processing batch. The deposit is non-refundable. Final price is by the pound — we'll invoice you the day before pickup once we have final weights. Pickup is local only.",
    availability: "preorder" as const,
    imageUrl: null,
    displayOrder: 3,
  },
  {
    name: "Pastured Turkey",
    description:
      "Heritage-breed pasture-raised turkeys, whole bird only. Giblets included. Final price is by the pound — deposit reserves your bird for the season. Limited availability.",
    productType: "meat_turkey" as const,
    pricingType: "deposit" as const,
    priceInCents: 5000,
    unitLabel: null,
    depositDescription:
      "Your $50 deposit reserves your turkey for the season. The deposit is non-refundable. Final price is by the pound — we'll invoice you the day before pickup once we have final weights. Pickup is local only.",
    availability: "preorder" as const,
    imageUrl: null,
    displayOrder: 4,
  },
];

async function seed() {
  console.log("Seeding products...");

  for (const product of products) {
    const existing = await db
      .select()
      .from(productsTable)
      .execute();

    if (existing.find((p) => p.name === product.name)) {
      console.log(`  Skipping "${product.name}" — already exists`);
      continue;
    }

    await db.insert(productsTable).values(product);
    console.log(`  Inserted "${product.name}"`);
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
