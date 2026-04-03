import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import {
  AdminLoginBody,
  AdminLoginResponse,
  AdminLogoutResponse,
  AdminMeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/admin/login", adminLoginLimiter, async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    req.log.error("ADMIN_PASSWORD environment variable is not set");
    res.status(500).json({ error: "Admin login is not configured" });
    return;
  }

  if (parsed.data.password !== adminPassword) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  req.session.admin = true;
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  res.json(AdminLoginResponse.parse({ message: "Logged in" }));
});

router.post("/admin/logout", async (req, res): Promise<void> => {
  await new Promise<void>((resolve) => {
    req.session.destroy(() => resolve());
  });
  res.json(AdminLogoutResponse.parse({ message: "Logged out" }));
});

router.get("/admin/me", (req, res): void => {
  const isAdmin = req.session.admin === true;
  res.json(AdminMeResponse.parse({ authenticated: isAdmin }));
});

export default router;
