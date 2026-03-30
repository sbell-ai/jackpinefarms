import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, couponsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";
import { z } from "zod";

const router: IRouter = Router();

const CreateCouponBody = z.object({
  code: z.string().min(1).max(50).toUpperCase().transform(s => s.trim()).refine(s => !/\s/.test(s), { message: "Coupon code cannot contain spaces" }),
  description: z.string().max(200).optional(),
  discountType: z.enum(["percent", "fixed_cents"]),
  discountValue: z.number().int().positive(),
  minOrderCents: z.number().int().min(0).optional().default(0),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
}).superRefine((data, ctx) => {
  if (data.discountType === "percent" && data.discountValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Percent discount cannot exceed 100%", path: ["discountValue"] });
  }
});

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

router.get("/admin/coupons", requireAdmin, async (_req, res): Promise<void> => {
  const coupons = await db
    .select()
    .from(couponsTable)
    .orderBy(desc(couponsTable.createdAt));
  res.json(coupons);
});

router.post("/admin/coupons", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { code, description, discountType, discountValue, minOrderCents, maxRedemptions, expiresAt } = parsed.data;

  const existing = await db
    .select({ id: couponsTable.id })
    .from(couponsTable)
    .where(eq(couponsTable.code, code))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: `Coupon code "${code}" already exists` });
    return;
  }

  let stripeCouponId: string | null = null;
  let stripePromotionCodeId: string | null = null;
  const stripe = getStripe();

  if (stripe) {
    try {
      const stripeCoupon = await stripe.coupons.create({
        id: `JPFARM_${code}`,
        name: description ?? code,
        ...(discountType === "percent"
          ? { percent_off: discountValue }
          : { amount_off: discountValue, currency: "cad" }),
        duration: "once",
        ...(maxRedemptions != null ? { max_redemptions: maxRedemptions } : {}),
      });
      stripeCouponId = stripeCoupon.id;

      const promoCode = await stripe.promotionCodes.create({
        coupon: stripeCoupon.id,
        code,
        ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
      });
      stripePromotionCodeId = promoCode.id;
    } catch (err: any) {
      res.status(502).json({ error: `Stripe sync failed: ${err.message}. Coupon not created.` });
      return;
    }
  }

  const [coupon] = await db
    .insert(couponsTable)
    .values({
      code,
      description: description ?? null,
      discountType,
      discountValue,
      minOrderCents,
      maxRedemptions: maxRedemptions ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      stripeCouponId,
      stripePromotionCodeId,
    })
    .returning();

  res.status(201).json(coupon);
});

router.patch("/admin/coupons/:id/toggle", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid coupon ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }

  const newActive = !existing.isActive;

  const stripe = getStripe();

  if (stripe) {
    if (existing.stripePromotionCodeId) {
      try {
        await stripe.promotionCodes.update(existing.stripePromotionCodeId, { active: newActive });
      } catch (err: any) {
        console.warn("[admin-coupons] Stripe promo code toggle failed:", err.message);
      }
    } else if (newActive && existing.stripeCouponId == null) {
      try {
        const stripeCoupon = await stripe.coupons.create({
          id: `JPFARM_${existing.code}`,
          name: existing.description ?? existing.code,
          ...(existing.discountType === "percent"
            ? { percent_off: existing.discountValue }
            : { amount_off: existing.discountValue, currency: "cad" }),
          duration: "once",
        });
        const promoCode = await stripe.promotionCodes.create({
          coupon: stripeCoupon.id,
          code: existing.code,
        });
        await db.update(couponsTable)
          .set({ stripeCouponId: stripeCoupon.id, stripePromotionCodeId: promoCode.id })
          .where(eq(couponsTable.id, id));
      } catch (err: any) {
        console.warn("[admin-coupons] Stripe sync on activate failed:", err.message);
      }
    }
  }

  const [updated] = await db
    .update(couponsTable)
    .set({ isActive: newActive })
    .where(eq(couponsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/admin/coupons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid coupon ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Coupon not found" });
    return;
  }

  if (existing.redemptionsCount > 0) {
    res.status(409).json({ error: "Cannot delete a coupon that has been used. Deactivate it instead." });
    return;
  }

  const stripe = getStripe();
  if (stripe) {
    if (existing.stripePromotionCodeId) {
      stripe.promotionCodes
        .update(existing.stripePromotionCodeId, { active: false })
        .catch((err: any) => console.warn("[admin-coupons] Stripe promo code deactivation failed:", err.message));
    }
    if (existing.stripeCouponId) {
      stripe.coupons
        .del(existing.stripeCouponId)
        .catch((err: any) => console.warn("[admin-coupons] Stripe coupon deletion failed:", err.message));
    }
  }

  await db.delete(couponsTable).where(eq(couponsTable.id, id));
  res.json({ message: "Coupon deleted" });
});

export default router;
