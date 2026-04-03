import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, cmsPagesTable, cmsPageSeoTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";
import { z } from "zod";

const router: IRouter = Router();

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
  contentHtml: z.string().default(""),
});

const UpdatePageBody = z.object({
  slug: slugSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  contentHtml: z.string().optional(),
});

const UpdateSeoBody = z.object({
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  canonicalUrl: z.string().max(500).optional().nullable(),
  ogTitle: z.string().max(200).optional().nullable(),
  ogDescription: z.string().max(500).optional().nullable(),
  ogImageUrl: z.string().max(500).optional().nullable(),
  robots: z.enum(["index_follow", "noindex_nofollow"]).optional(),
});

// GET /admin/cms/pages
router.get("/admin/cms/pages", requireAdmin, async (_req, res): Promise<void> => {
  const pages = await db
    .select()
    .from(cmsPagesTable)
    .orderBy(desc(cmsPagesTable.updatedAt));
  res.json(pages);
});

// POST /admin/cms/pages
router.post("/admin/cms/pages", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { slug, title, contentHtml } = parsed.data;

  const existing = await db
    .select({ id: cmsPagesTable.id })
    .from(cmsPagesTable)
    .where(eq(cmsPagesTable.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: `Slug "${slug}" is already in use` });
    return;
  }

  const [page] = await db
    .insert(cmsPagesTable)
    .values({ slug, title, contentHtml })
    .returning();

  res.status(201).json(page);
});

// GET /admin/cms/pages/:id
router.get("/admin/cms/pages/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }

  const [page] = await db
    .select()
    .from(cmsPagesTable)
    .where(eq(cmsPagesTable.id, id))
    .limit(1);

  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.json(page);
});

// PATCH /admin/cms/pages/:id
router.patch("/admin/cms/pages/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }

  const parsed = UpdatePageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  if (updates.slug) {
    const existing = await db
      .select({ id: cmsPagesTable.id })
      .from(cmsPagesTable)
      .where(eq(cmsPagesTable.slug, updates.slug))
      .limit(1);
    if (existing.length > 0 && existing[0]!.id !== id) {
      res.status(409).json({ error: `Slug "${updates.slug}" is already in use` });
      return;
    }
  }

  const [page] = await db
    .update(cmsPagesTable)
    .set(updates)
    .where(eq(cmsPagesTable.id, id))
    .returning();

  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.json(page);
});

// POST /admin/cms/pages/:id/publish
router.post("/admin/cms/pages/:id/publish", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }

  const [page] = await db
    .update(cmsPagesTable)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(cmsPagesTable.id, id))
    .returning();

  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.json(page);
});

// POST /admin/cms/pages/:id/unpublish
router.post("/admin/cms/pages/:id/unpublish", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }

  const [page] = await db
    .update(cmsPagesTable)
    .set({ status: "draft" })
    .where(eq(cmsPagesTable.id, id))
    .returning();

  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.json(page);
});

// GET /admin/cms/pages/:id/seo
router.get("/admin/cms/pages/:id/seo", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }

  const [seo] = await db
    .select()
    .from(cmsPageSeoTable)
    .where(eq(cmsPageSeoTable.pageId, id))
    .limit(1);

  res.json(seo ?? {
    pageId: id,
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    ogTitle: null,
    ogDescription: null,
    ogImageUrl: null,
    robots: "index_follow",
    createdAt: null,
    updatedAt: null,
  });
});

// PATCH /admin/cms/pages/:id/seo
router.patch("/admin/cms/pages/:id/seo", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid page ID" });
    return;
  }

  const parsed = UpdateSeoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const pageExists = await db
    .select({ id: cmsPagesTable.id })
    .from(cmsPagesTable)
    .where(eq(cmsPagesTable.id, id))
    .limit(1);

  if (pageExists.length === 0) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  const updates = parsed.data;

  const [seo] = await db
    .insert(cmsPageSeoTable)
    .values({ pageId: id, ...updates })
    .onConflictDoUpdate({
      target: cmsPageSeoTable.pageId,
      set: { ...updates, updatedAt: new Date() },
    })
    .returning();

  res.json(seo);
});

// Public: GET /cms/pages/:slug  (published only)
router.get("/cms/pages/:slug", async (req, res): Promise<void> => {
  const slug = req.params["slug"] as string;

  const [page] = await db
    .select()
    .from(cmsPagesTable)
    .where(eq(cmsPagesTable.slug, slug))
    .limit(1);

  if (!page || page.status !== "published") {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  const [seo] = await db
    .select()
    .from(cmsPageSeoTable)
    .where(eq(cmsPageSeoTable.pageId, page.id))
    .limit(1);

  res.json({
    id: page.id,
    slug: page.slug,
    title: page.title,
    contentHtml: page.contentHtml,
    status: page.status,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt,
    seo: seo ?? {
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
      ogTitle: null,
      ogDescription: null,
      ogImageUrl: null,
      robots: "index_follow",
    },
  });
});

export default router;
