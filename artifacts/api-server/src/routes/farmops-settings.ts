import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, farmopsTenantsTable, farmopsUsersTable } from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";

const router: IRouter = Router();

// ── PATCH /farmops/settings/tenant ───────────────────────────────────────────
// Update tenant-level settings. Owner only.

const tenantBody = z.object({
  name: z.string().min(1, "Farm name is required").max(100).optional(),
  logoObjectKey: z.string().nullable().optional(),
});

router.patch(
  "/farmops/settings/tenant",
  requireFarmopsTenant,
  requireFarmopsRole("owner"),
  async (req, res): Promise<void> => {
    const parsed = tenantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const tenantId = req.farmopsTenant!.id;
    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.logoObjectKey !== undefined) updates.logoObjectKey = parsed.data.logoObjectKey;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [updated] = await db
      .update(farmopsTenantsTable)
      .set(updates)
      .where(eq(farmopsTenantsTable.id, tenantId))
      .returning({
        id: farmopsTenantsTable.id,
        name: farmopsTenantsTable.name,
        logoObjectKey: farmopsTenantsTable.logoObjectKey,
      });

    res.json(updated);
  },
);

// ── PATCH /farmops/settings/profile ──────────────────────────────────────────
// Update the current user's own name. Any authenticated tenant user.

const profileBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(10, "Phone number is required"),
});

router.patch(
  "/farmops/settings/profile",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const parsed = profileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const userId = req.farmopsUser!.id;
    const [updated] = await db
      .update(farmopsUsersTable)
      .set({ name: parsed.data.name, phone: parsed.data.phone })
      .where(eq(farmopsUsersTable.id, userId))
      .returning({ id: farmopsUsersTable.id, name: farmopsUsersTable.name, phone: farmopsUsersTable.phone });

    res.json(updated);
  },
);

// ── PATCH /farmops/settings/password ─────────────────────────────────────────
// Change password: verify currentPassword, hash and store newPassword.
// Any authenticated tenant user.

const passwordBody = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

router.patch(
  "/farmops/settings/password",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const parsed = passwordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const userId = req.farmopsUser!.id;

    // Re-fetch to get passwordHash (not on req.farmopsUser to avoid leaking it)
    const [user] = await db
      .select({ passwordHash: farmopsUsersTable.passwordHash })
      .from(farmopsUsersTable)
      .where(eq(farmopsUsersTable.id, userId))
      .limit(1);

    if (!user?.passwordHash) {
      res.status(400).json({ error: "No password set on this account" });
      return;
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db
      .update(farmopsUsersTable)
      .set({ passwordHash: newHash })
      .where(eq(farmopsUsersTable.id, userId));

    res.json({ message: "Password updated successfully" });
  },
);

export default router;
