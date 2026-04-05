/**
 * Integration test: login endpoint rate limiting.
 *
 * Mounts the real platform-admin-dashboard router on a minimal Express app
 * (no DB, no real session store) and verifies that the 11th POST /login
 * within the same 15-minute window returns 429.
 *
 * @workspace/db and drizzle-orm are fully mocked; no real DB connection is used.
 * The rate-limiter uses its default MemoryStore, which starts fresh in each
 * isolated test-runner process (pool: "forks").
 */

import { vi, describe, it, expect } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";

// ── @workspace/db mock ────────────────────────────────────────────────────────
// db.select() chain always resolves to [] (no admin found → every login → 401)
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from:  vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    })),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
    update: vi.fn(() => ({
      set:   vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    })),
  },
  platformAdminsTable:          { email: "email_col", id: "id_col", isActive: "active_col", passwordHash: "hash_col", mustChangePassword: "mcp_col", name: "name_col", role: "role_col" },
  platformAdminAuditLogsTable:  { _tag: "audit" },
  farmopsTenantsTable:          { _tag: "tenants" },
  farmopsUsersTable:            { _tag: "users" },
  farmopsSubscriptionAddonsTable: { _tag: "addons" },
}));

// ── drizzle-orm mock ──────────────────────────────────────────────────────────
// Query-builder helpers are only used to construct SQL ASTs — our mocked
// `where()` ignores whatever it receives, so these just need to not throw.
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

// ── Build minimal test app ────────────────────────────────────────────────────
// Import AFTER mocks so the router module sees the mocked dependencies.
const { default: dashboardRouter } = await import("../routes/platform-admin-dashboard.js");

const app = express();
app.use(express.json());
// MemoryStore is the default; fine for testing (suppresses a deprecation warn)
app.use(
  session({ secret: "test-secret-not-real", resave: false, saveUninitialized: false }),
);
// The login handler calls req.log.info on *success* only; all our logins fail
// so req.log is never accessed. No pino mock needed.
app.use("/superadmin", dashboardRouter);

// ─────────────────────────────────────────────────────────────────────────────

describe("POST /superadmin/login rate limiting", () => {
  const credentials = { email: "attacker@example.com", password: "wrong" };

  it("returns 429 on the 11th login attempt within the rate-limit window", async () => {
    // Attempts 1–10: bad credentials → 401 (all count against the limit)
    for (let i = 1; i <= 10; i++) {
      const res = await request(app).post("/superadmin/login").send(credentials);
      expect(res.status, `attempt ${i} should be 401`).toBe(401);
    }

    // Attempt 11: rate limit exceeded → 429
    const res = await request(app).post("/superadmin/login").send(credentials);
    expect(res.status).toBe(429);
  });
});
