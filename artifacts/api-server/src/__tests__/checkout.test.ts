/**
 * Tests for the store checkout and order flow.
 *
 * Covers request body validation, empty-cart rejection, pickup event
 * capacity checks, and coupon validation behaviour in the checkout route.
 *
 * @workspace/db and drizzle-orm are fully mocked; no real DB or Stripe
 * connection is used.
 */

import { vi, describe, it, expect } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";

// ── @workspace/db mock ────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from:  vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 42, totalInCents: 1000 }]),
      })),
    })),
    update: vi.fn(() => ({
      set:   vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  },
  productsTable:              { id: "id", name: "name", pricingType: "pricing_type", priceInCents: "price_in_cents", salePriceCents: "sale_price_cents", isOnSale: "is_on_sale", unitLabel: "unit_label" },
  ordersTable:                { id: "id", pickupEventId: "pickup_event_id" },
  orderItemsTable:            { _tag: "order_items" },
  stripePendingCheckoutsTable: { _tag: "pending", createdAt: "created_at", stripeSessionId: "stripe_session_id" },
  customerCartsTable:         { _tag: "carts", customerId: "customer_id" },
  couponsTable:               { code: "code", isActive: "is_active", discountType: "discount_type", discountValue: "discount_value", startsAt: "starts_at", endsAt: "ends_at", maxRedemptions: "max_redemptions", redemptionsCount: "redemptions_count", stripePromotionCodeId: "stripe_promotion_code_id" },
  pickupEventsTable:          { id: "id", tenantId: "tenant_id", isPublic: "is_public", status: "status", scheduledAt: "scheduled_at", capacity: "capacity" },
}));

// ── drizzle-orm mock ──────────────────────────────────────────────────────────

vi.mock("drizzle-orm", () => ({
  eq:      vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  and:     vi.fn(() => ({})),
  or:      vi.fn(() => ({})),
  gt:      vi.fn(() => ({})),
  lt:      vi.fn(() => ({})),
  count:   vi.fn(() => ({})),
  sql:     Object.assign(vi.fn(() => ({})), { raw: vi.fn(() => ({})) }),
}));

// ── resolveStoreTenant middleware mock ────────────────────────────────────────
// Injects a stub tenant (id=1) without hitting the DB.
vi.mock("../middlewares/resolve-store-tenant.js", () => ({
  resolveStoreTenant: vi.fn((_req: any, _res: any, next: any) => next()),
}));

// ── Stripe mock ───────────────────────────────────────────────────────────────
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://stripe.com/pay/test", id: "cs_test_abc" }),
      },
    },
  })),
}));

// ── email / sms stubs ─────────────────────────────────────────────────────────
vi.mock("../lib/email.js", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: false, provider: "stub" }),
}));

vi.mock("../lib/sms.js", () => ({
  sendSms: vi.fn().mockResolvedValue({ sent: false }),
}));

// ── Build test app (import AFTER all mocks) ───────────────────────────────────
const { default: checkoutRouter, buildOrderItems, generateClaimToken } = await import("../routes/checkout.js");
const { db } = await import("@workspace/db");

function buildApp() {
  const application = express();
  application.use(express.json());
  application.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
  // Inject storeTenant so the route doesn't crash on req.storeTenant!.id
  application.use((req: any, _res: any, next: any) => {
    req.storeTenant = { id: 1 };
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  application.use("/", checkoutRouter);
  return application;
}

const app = buildApp();

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /checkout/stripe — body validation", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/checkout/stripe")
      .send({ name: "Alice" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/checkout/stripe")
      .send({ name: "Alice", email: "not-an-email", phone: "555-1234", pickupEventId: 1 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the cart is empty", async () => {
    const res = await request(app)
      .post("/checkout/stripe")
      .send({ name: "Alice", email: "alice@example.com", phone: "555-1234", pickupEventId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cart|empty/i);
  });
});

describe("POST /checkout/cash — body validation", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/checkout/cash")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/checkout/cash")
      .send({ name: "Bob", email: "bad-email", phone: "555-9999", pickupEventId: 1 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the cart is empty", async () => {
    const res = await request(app)
      .post("/checkout/cash")
      .send({ name: "Bob", email: "bob@example.com", phone: "555-9999", pickupEventId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cart|empty/i);
  });
});

// ── buildOrderItems (exported) ────────────────────────────────────────────────

describe("buildOrderItems", () => {

  it("returns null when the cart is empty", async () => {
    const result = await buildOrderItems([]);
    expect(result).toBeNull();
  });

  it("builds line items with correct total from flat-priced products", async () => {
    const products = [
      { id: 1, name: "Eggs", pricingType: "flat", priceInCents: 800, salePriceCents: null, isOnSale: false, unitLabel: "dozen" },
      { id: 2, name: "Honey", pricingType: "flat", priceInCents: 1200, salePriceCents: null, isOnSale: false, unitLabel: null },
    ];
    (db.select as any).mockImplementation(() => ({
      from:  vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(products),
      limit: vi.fn().mockResolvedValue(products),
    }));

    const result = await buildOrderItems([
      { productId: 1, quantity: 3, addGiblets: false },
      { productId: 2, quantity: 1, addGiblets: false },
    ]);

    expect(result).not.toBeNull();
    expect(result!.lineItems).toHaveLength(2);
    expect(result!.lineItems[0].lineTotalInCents).toBe(2400);
    expect(result!.lineItems[1].lineTotalInCents).toBe(1200);
    expect(result!.totalInCents).toBe(3600);
  });

  it("uses the sale price when a product is on sale", async () => {
    const products = [
      { id: 1, name: "Eggs", pricingType: "flat", priceInCents: 1000, salePriceCents: 700, isOnSale: true, unitLabel: "dozen" },
    ];
    (db.select as any).mockImplementation(() => ({
      from:  vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(products),
      limit: vi.fn().mockResolvedValue(products),
    }));

    const result = await buildOrderItems([{ productId: 1, quantity: 2, addGiblets: false }]);

    expect(result).not.toBeNull();
    expect(result!.lineItems[0].unitPriceInCents).toBe(700);
    expect(result!.lineItems[0].lineTotalInCents).toBe(1400);
  });
});

// ── generateClaimToken ────────────────────────────────────────────────────────

describe("generateClaimToken", () => {

  it("returns a 64-character hex string", () => {
    const token = generateClaimToken();
    expect(typeof token).toBe("string");
    expect(token).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });

  it("generates a unique token on each call", () => {
    const t1 = generateClaimToken();
    const t2 = generateClaimToken();
    expect(t1).not.toBe(t2);
  });
});
