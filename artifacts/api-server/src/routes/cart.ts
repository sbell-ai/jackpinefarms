import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { inArray, eq, and } from "drizzle-orm";
import { db, productsTable, customerCartsTable, couponsTable } from "@workspace/db";
import { AddCartItemBody, RemoveCartItemParams } from "@workspace/api-zod";
import rateLimit from "express-rate-limit";
import { resolveStoreTenant } from "../middlewares/resolve-store-tenant.js";

const couponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many coupon attempts. Please wait a minute." },
});

const router: IRouter = Router();

export async function persistCartForCustomer(
  customerId: number | undefined,
  cart: Array<{ productId: number; quantity: number; addGiblets: boolean }>
) {
  if (!customerId) return;
  await db
    .insert(customerCartsTable)
    .values({ customerId, items: cart })
    .onConflictDoUpdate({ target: customerCartsTable.customerId, set: { items: cart, updatedAt: new Date() } });
}

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
      const isOnSale = product.isOnSale && product.salePriceCents != null;
      const unitPriceInCents = isOnSale
        ? product.salePriceCents!
        : product.priceInCents;
      const gibletsCents = item.addGiblets && isMeat ? 200 * item.quantity : 0;
      const lineTotalInCents = unitPriceInCents * item.quantity + gibletsCents;
      return {
        productId: item.productId,
        productName: product.name,
        productType: product.productType,
        pricingType: product.pricingType,
        unitPriceInCents,
        isOnSale: isOnSale ?? false,
        originalPriceInCents: product.priceInCents,
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

  if (session.appliedCouponCode) {
    const [coupon] = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.code, session.appliedCouponCode))
      .limit(1);

    const now = new Date();
    if (coupon && coupon.isActive &&
        (!coupon.startsAt || coupon.startsAt <= now) &&
        (!coupon.endsAt || coupon.endsAt >= now) &&
        (coupon.maxRedemptions == null || coupon.redemptionsCount < coupon.maxRedemptions)) {
      const discountAmountCents = coupon.discountType === "percent"
        ? Math.round(response.subtotalInCents * coupon.discountValue / 100)
        : Math.min(coupon.discountValue, response.subtotalInCents);
      const label = coupon.discountType === "percent"
        ? `${coupon.discountValue}% off`
        : `$${(coupon.discountValue / 100).toFixed(2)} off`;
      const fullResponse: typeof response & {
        appliedCoupon: { code: string; discountAmountCents: number; description: string; stripePromotionCodeId: string | null };
        totalAfterDiscountInCents: number;
      } = {
        ...response,
        appliedCoupon: {
          code: coupon.code,
          discountAmountCents,
          description: coupon.description ? `${coupon.description} (${label})` : label,
          stripePromotionCodeId: coupon.stripePromotionCodeId ?? null,
        },
        totalAfterDiscountInCents: Math.max(0, response.subtotalInCents - discountAmountCents),
      };
      res.json(fullResponse);
      return;
    } else {
      session.appliedCouponCode = null;
      session.save(() => {});
    }
  }

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

  const normalizedQty = Math.max(1, Math.round(quantity));

  const session = (req as any).session;
  if (!session.cart) session.cart = [];

  const existing = session.cart.find(
    (i: { productId: number }) => i.productId === productId
  );

  if (existing) {
    existing.quantity = existing.quantity + normalizedQty;
    if (addGiblets) existing.addGiblets = true;
  } else {
    session.cart.push({ productId, quantity: normalizedQty, addGiblets: addGiblets ?? false });
  }

  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  await persistCartForCustomer(session.customerId, session.cart);

  const response = await buildCartResponse(session.cart);
  res.json(response);
});

router.patch("/cart/items/:productId", async (req, res): Promise<void> => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const { quantity, addGiblets } = req.body;
  if (typeof quantity !== "number" || quantity < 0) {
    res.status(400).json({ error: "quantity must be a non-negative number" });
    return;
  }

  const session = (req as any).session;
  if (!session.cart) session.cart = [];

  if (quantity === 0) {
    session.cart = session.cart.filter((i: { productId: number }) => i.productId !== productId);
  } else {
    const normalizedQty = Math.max(1, Math.round(quantity));

    const existing = session.cart.find((i: { productId: number }) => i.productId === productId);
    if (existing) {
      existing.quantity = normalizedQty;
      if (typeof addGiblets === "boolean") existing.addGiblets = addGiblets;
    } else {
      session.cart.push({ productId, quantity: normalizedQty, addGiblets: addGiblets ?? false });
    }
  }

  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  await persistCartForCustomer(session.customerId, session.cart ?? []);

  const response = await buildCartResponse(session.cart ?? []);
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

  await persistCartForCustomer(session.customerId, session.cart ?? []);

  const response = await buildCartResponse(session.cart ?? []);
  res.json(response);
});

router.delete("/cart", async (req, res): Promise<void> => {
  const session = (req as any).session;
  session.cart = [];

  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  await persistCartForCustomer(session.customerId, []);

  res.json({ items: [], subtotalInCents: 0, itemCount: 0 });
});

router.post("/cart/clear", async (req, res): Promise<void> => {
  const session = (req as any).session;
  session.cart = [];

  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  await persistCartForCustomer(session.customerId, []);

  res.json({ items: [], subtotalInCents: 0, itemCount: 0 });
});

router.post("/cart/coupon", couponLimiter, resolveStoreTenant, async (req, res): Promise<void> => {
  const tenantId = req.storeTenant!.id;
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : null;
  if (!code) {
    res.status(400).json({ valid: false, error: "Coupon code is required" });
    return;
  }

  const session = (req as any).session;
  const sessionCart: Array<{ productId: number; quantity: number; addGiblets: boolean }> = session.cart ?? [];
  const cartData = await buildCartResponse(sessionCart);
  const subtotal = cartData.subtotalInCents;

  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(and(eq(couponsTable.code, code), eq(couponsTable.tenantId, tenantId)))
    .limit(1);

  if (!coupon) {
    res.json({ valid: false, error: "Invalid coupon code" });
    return;
  }

  if (!coupon.isActive) {
    res.json({ valid: false, error: "This coupon is no longer active" });
    return;
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    res.json({ valid: false, error: "This coupon is not yet active" });
    return;
  }

  if (coupon.endsAt && coupon.endsAt < now) {
    res.json({ valid: false, error: "This coupon has expired" });
    return;
  }

  if (coupon.maxRedemptions != null && coupon.redemptionsCount >= coupon.maxRedemptions) {
    res.json({ valid: false, error: "This coupon has reached its maximum uses" });
    return;
  }

  const discountAmountCents =
    coupon.discountType === "percent"
      ? Math.round(subtotal * coupon.discountValue / 100)
      : Math.min(coupon.discountValue, subtotal);

  const label =
    coupon.discountType === "percent"
      ? `${coupon.discountValue}% off`
      : `$${(coupon.discountValue / 100).toFixed(2)} off`;

  session.appliedCouponCode = coupon.code;
  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );

  res.json({
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountAmountCents,
    totalAfterDiscountInCents: Math.max(0, subtotal - discountAmountCents),
    description: coupon.description ? `${coupon.description} (${label})` : label,
    stripePromotionCodeId: coupon.stripePromotionCodeId ?? null,
  });
});

router.delete("/cart/coupon", async (req, res): Promise<void> => {
  const session = (req as any).session;
  session.appliedCouponCode = null;
  await new Promise<void>((resolve, reject) =>
    session.save((err: Error | null) => (err ? reject(err) : resolve()))
  );
  res.json({ removed: true });
});

export default router;
