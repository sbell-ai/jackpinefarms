/**
 * Unit tests for requirePlatformAdmin and requirePlatformAdminRole middleware.
 *
 * @workspace/db is fully mocked so no real DB connection is needed.
 * drizzle-orm's query helpers are mocked so fake table column stubs satisfy eq().
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ── DB mock ──────────────────────────────────────────────────────────────────
// db.select() returns a chainable builder; the final .limit() is overridden
// per-test to control what the "DB" returns.

const mockLimit = vi.fn<() => Promise<unknown[]>>();
const mockSelectChain = {
  from:  vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: mockLimit,
};

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => mockSelectChain),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
    update: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) })),
  },
  platformAdminsTable: {
    id:                 "col_id",
    email:              "col_email",
    name:               "col_name",
    role:               "col_role",
    isActive:           "col_is_active",
    mustChangePassword: "col_must_change",
  },
}));

// drizzle-orm helpers are only used to build SQL ASTs that our mocked `where()`
// ignores — they just need to not throw.
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
}));

// ── Import middleware after mocks are registered ──────────────────────────────
import {
  requirePlatformAdmin,
  requirePlatformAdminRole,
} from "../middlewares/require-platform-admin.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

type SessionShape = {
  platformAdminId?: number;
  farmopsUserId?: number;
  admin?: boolean;
};

function makeReq(session: SessionShape = {}): Request {
  return { session } as unknown as Request;
}

function makeRes() {
  const res = {
    status: vi.fn(),
    json:   vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response;
}

const ACTIVE_OWNER = {
  id:                 1,
  email:              "owner@jackpinefarms.farm",
  name:               "Jack Pine",
  role:               "owner",
  isActive:           true,
  mustChangePassword: false,
};

const ACTIVE_SUPPORT = { ...ACTIVE_OWNER, id: 2, role: "support" };
const INACTIVE_ADMIN = { ...ACTIVE_OWNER, id: 3, isActive: false };

// ─────────────────────────────────────────────────────────────────────────────
// requirePlatformAdmin
// ─────────────────────────────────────────────────────────────────────────────

describe("requirePlatformAdmin", () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn() as unknown as NextFunction;
    mockLimit.mockResolvedValue([]);  // default: no admin found
  });

  it("1. returns 401 when session has no platformAdminId and no legacy admin flag", async () => {
    const req = makeReq({});
    const res = makeRes();

    await requirePlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("2. returns 403 when session belongs to a FarmOps user (no admin identity)", async () => {
    const req = makeReq({ farmopsUserId: 99 });
    const res = makeRes();

    await requirePlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("3. calls next() and attaches admin to req when platformAdminId resolves to an active admin", async () => {
    mockLimit.mockResolvedValue([ACTIVE_OWNER]);
    const req = makeReq({ platformAdminId: 1 });
    const res = makeRes();

    await requirePlatformAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as Request & { platformAdmin?: unknown }).platformAdmin).toEqual(ACTIVE_OWNER);
  });

  it("4. returns 401 when platformAdminId is set but no admin row is found in DB", async () => {
    mockLimit.mockResolvedValue([]);  // no row
    const req = makeReq({ platformAdminId: 999 });
    const res = makeRes();

    await requirePlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("5. returns 401 when the resolved admin row has isActive = false", async () => {
    mockLimit.mockResolvedValue([INACTIVE_ADMIN]);
    const req = makeReq({ platformAdminId: 3 });
    const res = makeRes();

    await requirePlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("6. calls next() via legacy admin=true flag (no DB lookup needed)", async () => {
    const req = makeReq({ admin: true });
    const res = makeRes();

    await requirePlatformAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    // No DB query should have been issued
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requirePlatformAdminRole("owner")
// ─────────────────────────────────────────────────────────────────────────────

describe("requirePlatformAdminRole(\"owner\")", () => {
  const requireOwner = requirePlatformAdminRole("owner");
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn() as unknown as NextFunction;
    mockLimit.mockResolvedValue([]);
  });

  it("returns 401 when there is no platformAdminId in session", async () => {
    const req = makeReq({});
    const res = makeRes();

    await requireOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated admin has role=support (not owner)", async () => {
    mockLimit.mockResolvedValue([ACTIVE_SUPPORT]);
    const req = makeReq({ platformAdminId: 2 });
    const res = makeRes();

    await requireOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the authenticated admin has role=owner", async () => {
    mockLimit.mockResolvedValue([ACTIVE_OWNER]);
    const req = makeReq({ platformAdminId: 1 });
    const res = makeRes();

    await requireOwner(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
