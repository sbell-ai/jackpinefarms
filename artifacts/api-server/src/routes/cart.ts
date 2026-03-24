import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { inArray, eq } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { AddCartItemBody, RemoveCartItemParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function buildCartResponse(sessionCart: Array<{ productId: number; quantity: number; addGiblets: boolean }>) {
  if (sessionCart.length === 0) {
    return { items: [], subtotalInCents: 0, itemCount: 0 };
  }

  const productIds = sessionCart.map((i) => i.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const productMap = new Map(products.map((p) => [p.id, p]));

  const items = sessionCart
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      const isMeat = product.pricingType === "deposit";
      const unitPriceInCents = product.priceInCents;
      const gibletsCents = item.addGiblets && isMeat ? 200 * item.quantity : 0;
      const lineTotalInCents = unitPriceInCents * item.quantity + gibletsCents;
      return {
        productId: item.productId,
        productName: product.name,
        productType: product.productType,
        pricingType: product.pricingType,
        unitPriceInCents,
        quantity: item.quantity,
        addGiblets: item.addGiblets && isMeat,
        lineTotalInCents,
        unitLabel: product.unitLabel ?? null,
        imageUrl: product.imageUrl ?? null,
      };
    })
    .filter(Boolean);

  const subtotalInCents = items.reduce((sum, i) => sum + (i?.lineTotalInCents ?? 0), 0);
  const itemCount = items.reduce((sum, i) => sum + (i?.quantity ?? 0), 0);

  return { items, subtotalInCents, itemCount };
}

router.get("/cart", async (req, res): Promise<void> => {
  const session = (req as any).session;
  const cart: Array<{ productId: number; quantity: number; addGiblets: boolean }> = session.cart ?? [];
  const response = await buildCartResponse(cart);
  res.json(response);
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const parsed = AddCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, quantity, addGiblets } = parsed.data;

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (product.availability === "sold_out" || product.availability === "disabled") {
    res.status(400).json({ error: "Product is not available for ordering" });
    return;
  }

  const session = (req as any).session;
  if (!session.cart) session.cart = [];

  const existing = session.cart.find(
    (i: { productId: number }) => i.productId === productId
  );

  if (existing) {
    existing.quantity += quantity;
    if (addGiblets) existing.addGiblets = true;
  } else {
    session.cart.push({ productId, quantity, addGiblets: addGiblets ?? false });
  }

  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  const response = await buildCartResponse(session.cart);
  res.json(response);
});

router.delete("/cart/items/:productId", async (req, res): Promise<void> => {
  const parsed = RemoveCartItemParams.safeParse({ productId: Number(req.params.productId) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const session = (req as any).session;
  if (session.cart) {
    session.cart = session.cart.filter(
      (i: { productId: number }) => i.productId !== parsed.data.productId
    );
  }

  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  const response = await buildCartResponse(session.cart ?? []);
  res.json(response);
});

router.delete("/cart", async (req, res): Promise<void> => {
  const session = (req as any).session;
  session.cart = [];

  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  res.json({ items: [], total: 0, itemCount: 0 });
});

export default router;
