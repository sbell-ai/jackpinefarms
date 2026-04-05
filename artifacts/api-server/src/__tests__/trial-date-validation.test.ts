/**
 * Unit tests for the extend-trial date validation logic.
 *
 * The Zod schema used in the route handler is reproduced here so the
 * validation contract can be tested without mounting the full Express app.
 * The schema is: `z.string().datetime({ offset: true }).or(z.string().date())`
 * followed by a `new Date(value)` sanity check in the handler.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirror of the ExtendTrialBody schema in platform-admin-dashboard.ts
const ExtendTrialBody = z.object({
  trialEndsAt: z.string().datetime({ offset: true }).or(z.string().date()),
});

// Thin wrapper that also exercises the handler's `new Date()` guard
function validate(input: unknown): { ok: boolean; date?: Date; error?: string } {
  const parsed = ExtendTrialBody.safeParse(input);
  if (!parsed.success) return { ok: false, error: "schema" };
  const d = new Date(parsed.data.trialEndsAt);
  if (isNaN(d.getTime())) return { ok: false, error: "date-constructor" };
  return { ok: true, date: d };
}

describe("extend-trial date validation", () => {
  it("accepts a future ISO datetime with UTC offset", () => {
    const result = validate({ trialEndsAt: "2030-06-15T00:00:00Z" });
    expect(result.ok).toBe(true);
    expect(result.date!.getFullYear()).toBe(2030);
  });

  it("accepts a past ISO datetime (schema has no lower-bound restriction)", () => {
    const result = validate({ trialEndsAt: "2020-01-01T00:00:00+00:00" });
    expect(result.ok).toBe(true);
    expect(result.date!.getFullYear()).toBe(2020);
  });

  it("accepts today as a plain date string (YYYY-MM-DD)", () => {
    const today = new Date().toISOString().slice(0, 10); // "2026-04-05"
    const result = validate({ trialEndsAt: today });
    expect(result.ok).toBe(true);
  });

  it("rejects a plaintext non-date string", () => {
    const result = validate({ trialEndsAt: "next tuesday" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing trialEndsAt field", () => {
    const result = validate({});
    expect(result.ok).toBe(false);
  });

  it("rejects a date with no timezone offset (bare ISO datetime not accepted by schema)", () => {
    // "2030-01-01T00:00:00" has no offset — fails z.string().datetime({ offset: true })
    // and is not a plain date string either, so it should fail.
    const result = validate({ trialEndsAt: "2030-01-01T00:00:00" });
    expect(result.ok).toBe(false);
  });
});
