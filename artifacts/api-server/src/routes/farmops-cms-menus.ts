import { Router, type IRouter } from "express";
import { eq, asc, and } from "drizzle-orm";
import { z } from "zod";
import { db, cmsMenusTable, cmsMenuItemsTable } from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";

const router: IRouter = Router();

const PutMenuItemsBody = z.object({
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        url: z.string().min(1).max(500),
        /** Zero-based index of the parent item in the submitted array, or null for top-level */
        parentIndex: z.number().int().nullable().default(null),
      })
    )
    .max(20),
});

// ─── GET /farmops/cms/menus/:name ─────────────────────────────────────────────
// Returns flat list of items with parentId so the UI can build its own view.

router.get(
  "/farmops/cms/menus/:name",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const name = req.params["name"] as string;

    const [menu] = await db
      .select()
      .from(cmsMenusTable)
      .where(and(eq(cmsMenusTable.name, name), eq(cmsMenusTable.tenantId, tenantId)));

    if (!menu) {
      res.status(404).json({ error: "Menu not found" });
      return;
    }

    const items = await db
      .select()
      .from(cmsMenuItemsTable)
      .where(eq(cmsMenuItemsTable.menuId, menu.id))
      .orderBy(asc(cmsMenuItemsTable.sortOrder));

    res.json({ ...menu, items });
  }
);

// ─── PUT /farmops/cms/menus/:name/items ───────────────────────────────────────

router.put(
  "/farmops/cms/menus/:name/items",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const name = req.params["name"] as string;

    const parsed = PutMenuItemsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    // Find or create the menu for this tenant
    let [menu] = await db
      .select()
      .from(cmsMenusTable)
      .where(and(eq(cmsMenusTable.name, name), eq(cmsMenusTable.tenantId, tenantId)));

    if (!menu) {
      [menu] = await db
        .insert(cmsMenusTable)
        .values({ name, tenantId })
        .returning();
    }

    // Delete all existing items
    await db.delete(cmsMenuItemsTable).where(eq(cmsMenuItemsTable.menuId, menu.id));

    const { items } = parsed.data;
    if (items.length > 0) {
      // Phase 1: insert all items without parentId, capture new DB IDs in order
      const inserted = await db
        .insert(cmsMenuItemsTable)
        .values(
          items.map((item, idx) => ({
            menuId: menu.id,
            label: item.label,
            url: item.url,
            parentId: null,
            sortOrder: idx,
          }))
        )
        .returning({ id: cmsMenuItemsTable.id, sortOrder: cmsMenuItemsTable.sortOrder });

      // Sort by sortOrder to align with the submitted items array
      inserted.sort((a, b) => a.sortOrder - b.sortOrder);

      // Phase 2: update parentId for items that reference a parent by index
      for (let i = 0; i < items.length; i++) {
        const pi = items[i]!.parentIndex;
        if (pi != null && inserted[pi] != null) {
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

    const updatedItems = await db
      .select()
      .from(cmsMenuItemsTable)
      .where(eq(cmsMenuItemsTable.menuId, menu.id))
      .orderBy(asc(cmsMenuItemsTable.sortOrder));

    res.json({ ...menu, items: updatedItems });
  }
);

export default router;
