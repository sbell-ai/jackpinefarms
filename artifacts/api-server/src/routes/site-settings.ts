import { Router, type IRouter, type Request, type Response } from "express";
import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePlatformAdmin } from "../middlewares/require-admin.js";

const router: IRouter = Router();

const ALLOWED_KEYS = new Set([
  "image.hero_bg",
  "image.logo",
  "image.checkout_hero",
  "image.home_promise",
  "image.about_farm",
  "image.how_we_pasture",
  "image.how_we_feed",
  "image.product_fallback",
]);

router.get("/site-settings", async (_req: Request, res: Response) => {
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  res.json(result);
});

router.put(
  "/admin/site-settings/:key",
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    const { key } = req.params as { key: string };
    if (!ALLOWED_KEYS.has(key)) {
      res.status(400).json({ error: "Unknown setting key." });
      return;
    }
    const { value } = req.body as { value?: string };
    if (typeof value !== "string") {
      res.status(400).json({ error: "value must be a string." });
      return;
    }

    const [row] = await db
      .insert(siteSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { value, updatedAt: new Date() },
      })
      .returning();

    res.json(row);
  }
);

export default router;
