import type { Request, Response, NextFunction } from "express";

/**
 * IP allowlist middleware for sensitive admin routes.
 *
 * When ADMIN_ALLOWED_IPS is set to a comma-separated list of IPs (e.g.
 * "203.0.113.10,203.0.113.11"), only requests from those IPs are permitted.
 * All others receive a 404 (deliberately vague, to avoid revealing the route).
 *
 * When ADMIN_ALLOWED_IPS is not set, all IPs are permitted — this preserves
 * backwards compatibility and keeps development working without configuration.
 *
 * The IP is sourced from req.ip, which respects the "trust proxy" setting on
 * the Express app (set to 1 in app.ts so the real client IP is used in
 * production behind Replit's reverse proxy).
 */
export function requireAllowedIp(req: Request, res: Response, next: NextFunction): void {
  const allowedIpsEnv = process.env.ADMIN_ALLOWED_IPS;
  if (!allowedIpsEnv) {
    next();
    return;
  }

  const allowedIps = allowedIpsEnv.split(",").map((ip) => ip.trim()).filter(Boolean);
  const clientIp = req.ip ?? "";

  if (allowedIps.includes(clientIp)) {
    next();
    return;
  }

  res.status(404).send("Not Found");
}
