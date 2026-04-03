import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, cmsMenusTable, cmsMenuItemsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/require-platform-admin.js";
import { z } from "zod";

const router: IRouter = Router();

const MenuItemInput = z.object({
  label: z.string().min(1).max(200),
  url: z.string().min(1).max(500),
  isHidden: z.boolean().default(false),
});

const PutMenuItemsBody = z.object({
  items: z.array(MenuItemInput),
});

async function getMenuWithItems(name: string) {
  const [menu] = await db
    .select()
    .from(cmsMenusTable)
    .where(eq(cmsMenusTable.name, name));
  if (!menu) return null;

  const items = await db
    .select()
    .from(cmsMenuItemsTable)
    .where(eq(cmsMenuItemsTable.menuId, menu.id))
    .orderBy(asc(cmsMenuItemsTable.sortOrder));

  return { ...menu, items };
}

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET /admin/cms/menus — list all menus with items
router.get("/admin/cms/menus", requirePlatformAdmin, async (_req, res) => {
  const menus = await db.select().from(cmsMenusTable).orderBy(asc(cmsMenusTable.name));
  const result = await Promise.all(
    menus.map(async (menu) => {
      const items = await db
        .select()
        .from(cmsMenuItemsTable)
        .where(eq(cmsMenuItemsTable.menuId, menu.id))
        .orderBy(asc(cmsMenuItemsTable.sortOrder));
      return { ...menu, items };
    }),
  );
  res.json(result);
});

// GET /admin/cms/menus/:name — single menu with items
router.get("/admin/cms/menus/:name", requirePlatformAdmin, async (req, res) => {
  const menu = await getMenuWithItems(req.params["name"] as string);
  if (!menu) {
    res.status(404).json({ error: "Menu not found" });
    return;
  }
  res.json(menu);
});

// PUT /admin/cms/menus/:name/items — replace all items for a menu
router.put("/admin/cms/menus/:name/items", requirePlatformAdmin, async (req, res) => {
  const parsed = PutMenuItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const [menu] = await db
    .select()
    .from(cmsMenusTable)
    .where(eq(cmsMenusTable.name, req.params["name"] as string));
  if (!menu) {
    res.status(404).json({ error: "Menu not found" });
    return;
  }

  await db.delete(cmsMenuItemsTable).where(eq(cmsMenuItemsTable.menuId, menu.id));

  const { items } = parsed.data;
  if (items.length > 0) {
    await db.insert(cmsMenuItemsTable).values(
      items.map((item, idx) => ({
        menuId: menu.id,
        label: item.label,
        url: item.url,
        isHidden: item.isHidden,
        sortOrder: idx,
      })),
    );
  }

  await db
    .update(cmsMenusTable)
    .set({ updatedAt: new Date() })
    .where(eq(cmsMenusTable.id, menu.id));

  const updated = await getMenuWithItems(req.params["name"] as string);
  res.json(updated);
});

// ── Public route ──────────────────────────────────────────────────────────────

// GET /cms/menus/:name — public, visible items only
router.get("/cms/menus/:name", async (req, res) => {
  const [menu] = await db
    .select()
    .from(cmsMenusTable)
    .where(eq(cmsMenusTable.name, req.params["name"] as string));
  if (!menu) {
    res.status(404).json({ error: "Menu not found" });
    return;
  }

  const items = await db
    .select()
    .from(cmsMenuItemsTable)
    .where(eq(cmsMenuItemsTable.menuId, menu.id))
    .orderBy(asc(cmsMenuItemsTable.sortOrder));

  const visible = items.filter((i) => !i.isHidden);
  res.json({ ...menu, items: visible });
});

export default router;
