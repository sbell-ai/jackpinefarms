/**
 * Tests confirming that emails are sent when an admin suspends, reactivates,
 * or changes the plan of a tenant.
 *
 * @workspace/db, drizzle-orm, and ../lib/email.js are mocked.
 * requirePlatformAdmin and requirePlatformAdminRole are bypassed so we can
 * exercise the route handlers directly without session/DB auth overhead.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";

// ── Stub tenant returned by db.update().returning() ──────────────────────────

const STUB_TENANT = {
  id:         1,
  name:       "Test Farm",
  ownerEmail: "owner@testfarm.com",
  status:     "active",
  plan:       "starter",
  slug:       "test-farm",
  updatedAt:  new Date(),
};

// ── @workspace/db mock ────────────────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from:  vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([STUB_TENANT]),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({
      set:       vi.fn().mockReturnThis(),
      where:     vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([STUB_TENANT]),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    execute: vi.fn().mockResolvedValue({}),
  },
  platformAdminsTable:            { id: "id", email: "email", name: "name", role: "role", isActive: "is_active", mustChangePassword: "must_change_password" },
  platformAdminAuditLogsTable:    { _tag: "audit" },
  farmopsTenantsTable:            { id: "id", slug: "slug", ownerEmail: "owner_email", plan: "plan", status: "status", createdByAdminId: "created_by_admin_id" },
  farmopsUsersTable:              { _tag: "users" },
  farmopsSubscriptionAddonsTable: { _tag: "addons" },
}));

// ── drizzle-orm mock ──────────────────────────────────────────────────────────

vi.mock("drizzle-orm", () => ({
  eq:     vi.fn(() => ({})),
  ilike:  vi.fn(() => ({})),
  and:    vi.fn(() => ({})),
  or:     vi.fn(() => ({})),
  desc:   vi.fn(() => ({})),
  gte:    vi.fn(() => ({})),
  lt:     vi.fn(() => ({})),
  sql:    Object.assign(vi.fn(() => ({})), { raw: vi.fn(() => ({})) }),
  index:  vi.fn(() => ({ on: vi.fn() })),
}));

// ── Auth middleware mock — bypass auth, inject a stub owner admin ─────────────

vi.mock("../middlewares/require-platform-admin.js", () => ({
  requirePlatformAdmin: vi.fn((_req: any, _res: any, next: any) => next()),
  requirePlatformAdminRole: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

// ── Audit log mock — fire-and-forget, swallow all errors ─────────────────────

vi.mock("../lib/audit.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// ── Email spy ─────────────────────────────────────────────────────────────────

const sendEmailMock = vi.fn().mockResolvedValue({ sent: true, provider: "stub" });
vi.mock("../lib/email.js", () => ({
  sendEmail: sendEmailMock,
}));

// ── Build test app ────────────────────────────────────────────────────────────

const { default: dashboardRouter } = await import("../routes/platform-admin-dashboard.js");

const app = express();
app.use(express.json());
app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
app.use((req: any, _res: any, next: any) => {
  req.session.platformAdminId = 1;
  req.platformAdmin = { id: 1, email: "admin@example.com", name: "Admin", role: "owner", isActive: true, mustChangePassword: false };
  req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  next();
});
app.use("/superadmin", dashboardRouter);

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  sendEmailMock.mockClear();
});

describe("POST /superadmin/tenants/:id/suspend", () => {
  it("sends a suspension email to the tenant owner", async () => {
    const res = await request(app).post("/superadmin/tenants/1/suspend");

    expect(res.status).toBe(200);

    // Wait a tick for fire-and-forget email
    await new Promise((r) => setTimeout(r, 10));

    expect(sendEmailMock).toHaveBeenCalledOnce();
    const [msg] = sendEmailMock.mock.calls[0];
    expect(msg.to).toBe(STUB_TENANT.ownerEmail);
    expect(msg.subject).toMatch(/suspended/i);
  });
});

describe("POST /superadmin/tenants/:id/reactivate", () => {
  it("sends a reactivation email to the tenant owner", async () => {
    const res = await request(app).post("/superadmin/tenants/1/reactivate");

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 10));

    expect(sendEmailMock).toHaveBeenCalledOnce();
    const [msg] = sendEmailMock.mock.calls[0];
    expect(msg.to).toBe(STUB_TENANT.ownerEmail);
    expect(msg.subject).toMatch(/reactivated/i);
  });
});

describe("POST /superadmin/tenants/:id/change-plan", () => {
  it("sends a plan-change email with the new plan name in the subject", async () => {
    const res = await request(app)
      .post("/superadmin/tenants/1/change-plan")
      .send({ plan: "growth" });

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 10));

    expect(sendEmailMock).toHaveBeenCalledOnce();
    const [msg] = sendEmailMock.mock.calls[0];
    expect(msg.to).toBe(STUB_TENANT.ownerEmail);
    expect(msg.subject).toMatch(/growth/i);
  });

  it("returns 400 when an invalid plan is provided", async () => {
    const res = await request(app)
      .post("/superadmin/tenants/1/change-plan")
      .send({ plan: "enterprise" });

    expect(res.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
