import "../types/session.d.ts";
import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, platformAdminsTable } from "@workspace/db";

/**
 * requirePlatformAdmin
 *
 * Authenticates the request as a platform admin by looking up the full admin
 * record and attaching it to req.platformAdmin.  Requires a valid
 * `platformAdminId` session key; the old `admin: true` boolean flag has been
 * removed (security fix — it bypassed DB lookups and isActive checks).
 */
export async function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Block FarmOps users from ever accessing Jack Pine admin routes
  if (req.session.farmopsUserId && !req.session.platformAdminId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!req.session.platformAdminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [admin] = await db
    .select({
      id:                 platformAdminsTable.id,
      email:              platformAdminsTable.email,
      name:               platformAdminsTable.name,
      role:               platformAdminsTable.role,
      isActive:           platformAdminsTable.isActive,
      mustChangePassword: platformAdminsTable.mustChangePassword,
    })
    .from(platformAdminsTable)
    .where(eq(platformAdminsTable.id, req.session.platformAdminId))
    .limit(1);

  if (!admin || !admin.isActive) {
    delete req.session.platformAdminId;
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.platformAdmin = admin;
  next();
}

/**
 * requirePlatformAdminRole(role)
 *
 * Factory that returns a middleware requiring both platform admin authentication
 * AND a specific role.  Performs the full DB lookup (same as requirePlatformAdmin)
 * and then checks req.platformAdmin.role.
 *
 * Usage (owner-only route):
 *   router.post("/tenants/:id/suspend", requirePlatformAdminRole("owner"), handler)
 */
export function requirePlatformAdminRole(role: string) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    // Block FarmOps users
    if (req.session.farmopsUserId && !req.session.platformAdminId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!req.session.platformAdminId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [admin] = await db
      .select({
        id:                 platformAdminsTable.id,
        email:              platformAdminsTable.email,
        name:               platformAdminsTable.name,
        role:               platformAdminsTable.role,
        isActive:           platformAdminsTable.isActive,
        mustChangePassword: platformAdminsTable.mustChangePassword,
      })
      .from(platformAdminsTable)
      .where(eq(platformAdminsTable.id, req.session.platformAdminId))
      .limit(1);

    if (!admin || !admin.isActive) {
      delete req.session.platformAdminId;
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (admin.role !== role) {
      res.status(403).json({ error: "Forbidden: insufficient role" });
      return;
    }

    req.platformAdmin = admin;
    next();
  };
}
