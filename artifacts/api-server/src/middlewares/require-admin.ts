import "../types/session.d.ts";
import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Block FarmOps users from ever accessing Jack Pine admin routes
  if (req.session.farmopsUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (req.session.admin !== true) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
