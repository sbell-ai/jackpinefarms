import "../types/session.d.ts";
import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, platformAdminsTable } from "@workspace/db";

/**
 * requirePlatformAdmin
 *
 * Replaces the legacy `requireAdmin` (boolean session flag) with a real DB lookup.
 * Accepts either the new `platformAdminId` session key OR the legacy `admin: true`
 * flag — the latter bridges the transition window while the admin UI is being updated.
 *
 * Once the legacy flag path is no longer needed, remove the `admin === true` branch.
 */
export async function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Block FarmOps users from ever accessing Jack Pine admin routes
  if (req.session.farmopsUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // ── New path: session has a real admin identity ──────────────────────────
  if (req.session.platformAdminId) {
    const [admin] = await db
      .select({ id: platformAdminsTable.id, isActive: platformAdminsTable.isActive })
      .from(platformAdminsTable)
      .where(eq(platformAdminsTable.id, req.session.platformAdminId))
      .limit(1);

    if (!admin || !admin.isActive) {
      // Admin deactivated or row deleted — invalidate session
      delete req.session.platformAdminId;
      delete req.session.admin;
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
    return;
  }

  // ── Legacy path: old boolean flag (kept during transition) ───────────────
  if (req.session.admin === true) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}
