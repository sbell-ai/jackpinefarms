/**
 * Unit tests for logAuditEvent helper.
 *
 * Verifies the DB insert is called with the correct column shape, and that
 * a DB error is swallowed so it never propagates to the caller.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockInsertValues = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(),
    update: vi.fn(),
  },
  platformAdminAuditLogsTable: { _tag: "audit_logs_table" },
}));

import { db } from "@workspace/db";
import { logAuditEvent } from "../lib/audit.js";

describe("logAuditEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue([]);
  });

  it("inserts a row with all provided fields", async () => {
    await logAuditEvent(1, "tenant.suspend", "tenant", 42, { reason: "test" });

    expect(vi.mocked(db.insert)).toHaveBeenCalledOnce();
    expect(mockInsertValues).toHaveBeenCalledWith({
      adminId:    1,
      action:     "tenant.suspend",
      targetType: "tenant",
      targetId:   42,
      metadata:   { reason: "test" },
    });
  });

  it("inserts nulls when optional fields are omitted", async () => {
    await logAuditEvent(5, "admin.login");

    expect(mockInsertValues).toHaveBeenCalledWith({
      adminId:    5,
      action:     "admin.login",
      targetType: null,
      targetId:   null,
      metadata:   null,
    });
  });

  it("inserts null for adminId when passed null", async () => {
    await logAuditEvent(null, "admin.logout");

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: null, action: "admin.logout" }),
    );
  });

  it("does not throw when the DB insert rejects", async () => {
    mockInsertValues.mockRejectedValue(new Error("DB connection lost"));

    // Must resolve without throwing
    await expect(logAuditEvent(1, "admin.login")).resolves.toBeUndefined();
  });
});
