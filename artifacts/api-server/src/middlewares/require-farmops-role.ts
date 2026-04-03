import "../types/session.d.ts";
import { Request, Response, NextFunction } from "express";

/**
 * Role hierarchy within a FarmOps tenant.
 * Higher index = more privilege.
 *   member — read-only (future enforcement)
 *   admin  — full farm ops, no billing or user management
 *   owner  — everything including billing and user management
 */
const ROLE_TIERS = ["member", "admin", "owner"] as const;
export type FarmopsRole = (typeof ROLE_TIERS)[number];

/**
 * requireFarmopsRole(minimumRole)
 *
 * Factory that returns middleware enforcing a minimum role tier within a tenant.
 * MUST run after requireFarmopsTenant so req.farmopsUser is already populated.
 *
 * Usage:
 *   router.delete("/farmops/users/:id",
 *     requireFarmopsTenant,
 *     requireFarmopsRole("owner"),
 *     handler
 *   );
 *
 * An owner satisfies any role requirement.
 * An admin satisfies "admin" or "member" requirements, but not "owner".
 * A member only satisfies "member" requirements.
 */
export function requireFarmopsRole(minimumRole: FarmopsRole) {
  return function roleGuard(req: Request, res: Response, next: NextFunction): void {
    const user = req.farmopsUser;
    if (!user) {
      // requireFarmopsTenant didn't run or failed — shouldn't happen in normal usage
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const userTier     = ROLE_TIERS.indexOf(user.role as FarmopsRole);
    const requiredTier = ROLE_TIERS.indexOf(minimumRole);

    if (userTier < requiredTier) {
      res.status(403).json({
        error: "insufficient_role",
        message: `This action requires the ${minimumRole} role or higher.`,
        yourRole: user.role,
        requiredRole: minimumRole,
      });
      return;
    }

    next();
  };
}
