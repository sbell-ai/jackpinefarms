import { Router, type IRouter } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { db, cmsPagesTable, cmsPageSeoTable } from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";

const router: IRouter = Router();

const ALLOWED_CMS_HTML_TAGS = ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a"];
const ALLOWED_CMS_HTML_ATTRS = { a: ["href", "title", "target", "rel"] };

const contentHtmlSchema = z.string().transform((html) =>
  sanitizeHtml(html, { allowedTags: ALLOWED_CMS_HTML_TAGS, allowedAttributes: ALLOWED_CMS_HTML_ATTRS })
);

const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "account", "shop", "cart", "checkout",
  "order-confirmation", "pickup-events", "unsubscribe", "policies",
  "how-we-raise-them", "p",
]);

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only")
  .refine((s) => !RESERVED_SLUGS.has(s), { message: "This slug is reserved" });

const CreatePageBody = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(200),
  contentHtml: contentHtmlSchema.default(""),
});

const UpdatePageBody = z.object({
  slug: slugSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  contentHtml: contentHtmlSchema.optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

// ─── GET /farmops/cms/pages ───────────────────────────────────────────────────

router.get(
  "/farmops/cms/pages",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;

    const pages = await db
      .select()
      .from(cmsPagesTable)
      .where(eq(cmsPagesTable.tenantId, tenantId))
      .orderBy(desc(cmsPagesTable.updatedAt));

    res.json(pages);
  }
);

// ─── POST /farmops/cms/pages ──────────────────────────────────────────────────

router.post(
  "/farmops/cms/pages",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = CreatePageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { slug, title, contentHtml } = parsed.data;

    // Check uniqueness within this tenant
    const [existing] = await db
      .select({ id: cmsPagesTable.id })
      .from(cmsPagesTable)
      .where(and(eq(cmsPagesTable.slug, slug), eq(cmsPagesTable.tenantId, tenantId)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: `Slug "${slug}" is already in use` });
      return;
    }

    const [page] = await db
      .insert(cmsPagesTable)
      .values({ tenantId, slug, title, contentHtml })
      .returning();

    res.status(201).json(page);
  }
);

// ─── GET /farmops/cms/pages/:id ───────────────────────────────────────────────

router.get(
  "/farmops/cms/pages/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid page ID" }); return; }
    const { id } = parsed.data;

    const [page] = await db
      .select()
      .from(cmsPagesTable)
      .where(and(eq(cmsPagesTable.id, id), eq(cmsPagesTable.tenantId, tenantId)))
      .limit(1);

    if (!page) { res.status(404).json({ error: "Page not found" }); return; }

    res.json(page);
  }
);

// ─── PATCH /farmops/cms/pages/:id ─────────────────────────────────────────────

router.patch(
  "/farmops/cms/pages/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid page ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = UpdatePageBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const [existing] = await db
      .select()
      .from(cmsPagesTable)
      .where(and(eq(cmsPagesTable.id, id), eq(cmsPagesTable.tenantId, tenantId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Page not found" }); return; }

    const updates = bodyParsed.data;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    // Check slug uniqueness if slug is being changed
    if (updates.slug && updates.slug !== existing.slug) {
      const [conflict] = await db
        .select({ id: cmsPagesTable.id })
        .from(cmsPagesTable)
        .where(and(eq(cmsPagesTable.slug, updates.slug), eq(cmsPagesTable.tenantId, tenantId)))
        .limit(1);
      if (conflict) {
        res.status(409).json({ error: `Slug "${updates.slug}" is already in use` });
        return;
      }
    }

    const [updated] = await db
      .update(cmsPagesTable)
      .set(updates)
      .where(eq(cmsPagesTable.id, id))
      .returning();

    res.json(updated);
  }
);

// ─── POST /farmops/cms/pages/:id/publish ──────────────────────────────────────

router.post(
  "/farmops/cms/pages/:id/publish",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid page ID" }); return; }
    const { id } = parsed.data;

    const [page] = await db
      .update(cmsPagesTable)
      .set({ status: "published", publishedAt: new Date() })
      .where(and(eq(cmsPagesTable.id, id), eq(cmsPagesTable.tenantId, tenantId)))
      .returning();

    if (!page) { res.status(404).json({ error: "Page not found" }); return; }

    res.json(page);
  }
);

// ─── POST /farmops/cms/pages/:id/unpublish ────────────────────────────────────

router.post(
  "/farmops/cms/pages/:id/unpublish",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid page ID" }); return; }
    const { id } = parsed.data;

    const [page] = await db
      .update(cmsPagesTable)
      .set({ status: "draft" })
      .where(and(eq(cmsPagesTable.id, id), eq(cmsPagesTable.tenantId, tenantId)))
      .returning();

    if (!page) { res.status(404).json({ error: "Page not found" }); return; }

    res.json(page);
  }
);

// ─── DELETE /farmops/cms/pages/:id ────────────────────────────────────────────

router.delete(
  "/farmops/cms/pages/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid page ID" }); return; }
    const { id } = parsed.data;

    const [existing] = await db
      .select({ id: cmsPagesTable.id })
      .from(cmsPagesTable)
      .where(and(eq(cmsPagesTable.id, id), eq(cmsPagesTable.tenantId, tenantId)))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Page not found" }); return; }

    await db.delete(cmsPagesTable).where(eq(cmsPagesTable.id, id));

    res.status(204).send();
  }
);

export default router;
