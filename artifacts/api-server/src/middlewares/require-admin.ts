import "../types/session.d.ts";
import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.admin !== true) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
