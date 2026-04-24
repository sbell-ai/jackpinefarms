import { Router, type IRouter } from "express";
import { eq, asc, and, isNull } from "drizzle-orm";
import { db, cmsMenusTable, cmsMenuItemsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/require-platform-admin.js";
import { resolveStoreTenant } from "../middlewares/resolve-store-tenant.js";
import { z } from "zod";

const router: IRouter = Router();

const MenuItemInput = z.object({
  label: z.string().min(1).max(200),
  url: z.string().min(1).max(500),
  isHidden: z.boolean().default(false),
  /** Zero-based index of the parent in the submitted array, or null for top-level */
  parentIndex: z.number().int().nullable().default(null),
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

  const { items } = parsed.data;

  // Validate parentIndex bounds BEFORE any DB writes to prevent partial mutations
  for (let i = 0; i < items.length; i++) {
    const pi = items[i]!.parentIndex;
    if (pi == null) continue;
    if (pi < 0 || pi >= items.length) {
      res.status(400).json({ error: `Item ${i}: parentIndex ${pi} is out of bounds (0–${items.length - 1})` });
      return;
    }
    if (pi === i) {
      res.status(400).json({ error: `Item ${i}: parentIndex cannot reference itself` });
      return;
    }
  }

  await db.delete(cmsMenuItemsTable).where(eq(cmsMenuItemsTable.menuId, menu.id));

  if (items.length > 0) {
    // Phase 1: insert all items without parentId, capture new DB IDs in order
    const inserted = await db
      .insert(cmsMenuItemsTable)
      .values(
        items.map((item, idx) => ({
          menuId: menu.id,
          label: item.label,
          url: item.url,
          isHidden: item.isHidden,
          parentId: null,
          sortOrder: idx,
        })),
      )
      .returning({ id: cmsMenuItemsTable.id, sortOrder: cmsMenuItemsTable.sortOrder });

    // Sort by sortOrder to align with the submitted items array
    inserted.sort((a, b) => a.sortOrder - b.sortOrder);

    // Phase 2: update parentId for items that have a parentIndex
    for (let i = 0; i < items.length; i++) {
      const pi = items[i]!.parentIndex;
      if (pi != null) {
        await db
          .update(cmsMenuItemsTable)
          .set({ parentId: inserted[pi]!.id })
          .where(eq(cmsMenuItemsTable.id, inserted[i]!.id));
      }
    }
  }

  await db
    .update(cmsMenusTable)
    .set({ updatedAt: new Date() })
    .where(eq(cmsMenusTable.id, menu.id));

  const updated = await getMenuWithItems(req.params["name"] as string);
  res.json(updated);
});

// ── Public route ──────────────────────────────────────────────────────────────

// GET /cms/menus/:name — public, visible items only, tenant-scoped with platform fallback
router.get("/cms/menus/:name", resolveStoreTenant, async (req, res) => {
  const name = req.params["name"] as string;
  const tenantId = req.storeTenant?.id ?? null;

  // Try tenant-specific menu first, then fall back to platform menu (tenant_id IS NULL)
  let menu: typeof cmsMenusTable.$inferSelect | undefined;
  if (tenantId != null) {
    [menu] = await db
      .select()
      .from(cmsMenusTable)
      .where(and(eq(cmsMenusTable.name, name), eq(cmsMenusTable.tenantId, tenantId)));
  }
  if (!menu) {
    [menu] = await db
      .select()
      .from(cmsMenusTable)
      .where(and(eq(cmsMenusTable.name, name), isNull(cmsMenusTable.tenantId)));
  }

  // No menu found → return empty rather than 404 (new tenants have no menus yet)
  if (!menu) {
    res.json({ id: null, name, tenantId, items: [] });
    return;
  }

  const items = await db
    .select()
    .from(cmsMenuItemsTable)
    .where(eq(cmsMenuItemsTable.menuId, menu.id))
    .orderBy(asc(cmsMenuItemsTable.sortOrder));

  const topLevel = items.filter(i => !i.isHidden && i.parentId === null);
  const children = items.filter(i => !i.isHidden && i.parentId !== null);

  const nested = topLevel.map(parent => ({
    ...parent,
    children: children.filter(child => child.parentId === parent.id),
  }));

  res.json({ ...menu, items: nested });
});

export default router;
