import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, couponsTable } from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router: IRouter = Router();

const CreateCouponBody = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .transform(s => s.trim().toUpperCase())
    .refine(s => !/\s/.test(s), { message: "Coupon code cannot contain spaces" }),
  description: z.string().max(200).optional(),
  discountType: z.enum(["percent", "amount"]),
  discountValue: z.number().int().positive(),
  maxRedemptions: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
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

async function createStripeObjects(
  stripe: ReturnType<typeof getStripe>,
  opts: {
    code: string;
    description: string | undefined;
    discountType: "percent" | "amount";
    discountValue: number;
    maxRedemptions: number | undefined;
    endsAt: string | undefined;
  }
): Promise<{ stripeCouponId: string; stripePromotionCodeId: string }> {
  if (!stripe) throw new Error("Stripe not configured");

  const stripeCoupon = await stripe.coupons.create({
    id: opts.code,
    name: opts.description ?? opts.code,
    ...(opts.discountType === "percent"
      ? { percent_off: opts.discountValue }
      : { amount_off: opts.discountValue, currency: "cad" }),
    duration: "once",
    ...(opts.maxRedemptions != null ? { max_redemptions: opts.maxRedemptions } : {}),
    ...(opts.endsAt ? { redeem_by: Math.floor(new Date(opts.endsAt).getTime() / 1000) } : {}),
  });

  const promoCode = await stripe.promotionCodes.create({
    coupon: stripeCoupon.id,
    code: opts.code,
    ...(opts.maxRedemptions != null ? { max_redemptions: opts.maxRedemptions } : {}),
    ...(opts.endsAt ? { expires_at: Math.floor(new Date(opts.endsAt).getTime() / 1000) } : {}),
  });

  return { stripeCouponId: stripeCoupon.id, stripePromotionCodeId: promoCode.id };
}

// ─── GET /farmops/coupons ─────────────────────────────────────────────────────

router.get("/farmops/coupons", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;
  const coupons = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.tenantId, tenantId))
    .orderBy(desc(couponsTable.createdAt));
  res.json(coupons);
});

// ─── POST /farmops/coupons ────────────────────────────────────────────────────

router.post(
  "/farmops/coupons",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = CreateCouponBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { code, description, discountType, discountValue, maxRedemptions, startsAt, endsAt } = parsed.data;

    // Tenant-scoped duplicate check
    const existing = await db
      .select({ id: couponsTable.id })
      .from(couponsTable)
      .where(and(eq(couponsTable.code, code), eq(couponsTable.tenantId, tenantId)))
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
        const ids = await createStripeObjects(stripe, { code, description, discountType, discountValue, maxRedemptions, endsAt });
        stripeCouponId = ids.stripeCouponId;
        stripePromotionCodeId = ids.stripePromotionCodeId;
      } catch (err: unknown) {
        res.status(502).json({ error: `Stripe sync failed: ${(err as Error).message}. Coupon not created.` });
        return;
      }
    } else {
      logger.info({ code }, "[farmops-coupons] STRIPE_SECRET_KEY not set — skipping Stripe coupon/promo-code creation (stub)");
    }

    const [coupon] = await db
      .insert(couponsTable)
      .values({
        tenantId,
        code,
        description: description ?? null,
        discountType,
        discountValue,
        maxRedemptions: maxRedemptions ?? null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        stripeCouponId,
        stripePromotionCodeId,
      })
      .returning();

    res.status(201).json(coupon);
  }
);

// ─── PATCH /farmops/coupons/:id/toggle ───────────────────────────────────────

router.patch(
  "/farmops/coupons/:id/toggle",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid coupon ID" }); return; }

    const [existing] = await db
      .select()
      .from(couponsTable)
      .where(and(eq(couponsTable.id, id), eq(couponsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Coupon not found" }); return; }

    const newActive = !existing.isActive;
    const stripe = getStripe();

    if (stripe) {
      if (existing.stripePromotionCodeId) {
        try {
          await stripe.promotionCodes.update(existing.stripePromotionCodeId, { active: newActive });
        } catch (err: unknown) {
          res.status(502).json({ error: `Stripe sync failed: ${(err as Error).message}. Coupon not updated.` });
          return;
        }
      } else if (newActive) {
        try {
          const endsAtIso = existing.endsAt ? existing.endsAt.toISOString() : undefined;
          const ids = await createStripeObjects(stripe, {
            code: existing.code,
            description: existing.description ?? undefined,
            discountType: existing.discountType as "percent" | "amount",
            discountValue: existing.discountValue,
            maxRedemptions: existing.maxRedemptions ?? undefined,
            endsAt: endsAtIso,
          });
          await db.update(couponsTable)
            .set({ stripeCouponId: ids.stripeCouponId, stripePromotionCodeId: ids.stripePromotionCodeId })
            .where(eq(couponsTable.id, id));
        } catch (err: unknown) {
          res.status(502).json({ error: `Stripe sync failed: ${(err as Error).message}. Coupon not activated.` });
          return;
        }
      }
    } else {
      logger.info({ id, newActive }, "[farmops-coupons] STRIPE_SECRET_KEY not set — skipping Stripe promo-code toggle (stub)");
    }

    const [updated] = await db
      .update(couponsTable)
      .set({ isActive: newActive })
      .where(eq(couponsTable.id, id))
      .returning();

    res.json(updated);
  }
);

// ─── DELETE /farmops/coupons/:id ──────────────────────────────────────────────

router.delete(
  "/farmops/coupons/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid coupon ID" }); return; }

    const [existing] = await db
      .select()
      .from(couponsTable)
      .where(and(eq(couponsTable.id, id), eq(couponsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Coupon not found" }); return; }

    if (existing.redemptionsCount > 0) {
      res.status(409).json({ error: "Cannot delete a coupon that has been used. Deactivate it instead." });
      return;
    }

    const stripe = getStripe();
    if (stripe) {
      if (existing.stripePromotionCodeId) {
        stripe.promotionCodes
          .update(existing.stripePromotionCodeId, { active: false })
          .catch((err: unknown) => console.warn("[farmops-coupons] Stripe promo code deactivation failed:", (err as Error).message));
      }
      if (existing.stripeCouponId) {
        stripe.coupons
          .del(existing.stripeCouponId)
          .catch((err: unknown) => console.warn("[farmops-coupons] Stripe coupon deletion failed:", (err as Error).message));
      }
    }

    await db.delete(couponsTable).where(eq(couponsTable.id, id));
    res.json({ message: "Coupon deleted" });
  }
);

export default router;
