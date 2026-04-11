import { Router, type IRouter } from "express";
import { eq, and, desc, asc, count } from "drizzle-orm";
import { z } from "zod";
import { db, productsTable, productImagesTable, orderItemsTable } from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";
import { deleteStorageObject, ObjectStorageService } from "../lib/objectStorage.js";

const objectStorageService = new ObjectStorageService();

const router: IRouter = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });
const imageIdParam = z.object({
  id: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

const ProductBaseShape = z.object({
  name: z.string().min(1).max(200),
  description: z.string().default(""),
  productType: z.enum(["eggs_chicken", "eggs_duck", "meat_chicken", "meat_turkey"]),
  pricingType: z.enum(["unit", "deposit"]),
  priceInCents: z.number().int().positive(),
  unitLabel: z.string().optional().nullable(),
  depositDescription: z.string().optional().nullable(),
  isOnSale: z.boolean().optional().default(false),
  salePriceCents: z.number().int().positive().optional().nullable(),
  availability: z.enum(["taking_orders", "preorder", "sold_out", "disabled"]).default("taking_orders"),
  displayOrder: z.number().int().default(0),
});

const ProductBody = ProductBaseShape.superRefine((data, ctx) => {
  if (data.isOnSale) {
    if (!data.salePriceCents || data.salePriceCents <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sale price must be greater than $0 when on sale", path: ["salePriceCents"] });
    } else if (data.salePriceCents >= data.priceInCents) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sale price must be less than the regular price", path: ["salePriceCents"] });
    }
  }
});

const ProductUpdateBody = ProductBaseShape.partial();

const AddImageBody = z.object({
  objectPath: z.string().min(1),
  contentType: z.string().optional(),
  altText: z.string().optional(),
});

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
function isAllowedMimeType(ct: string | undefined): boolean {
  if (!ct) return false;
  return ALLOWED_MIME_TYPES.has(ct.toLowerCase().split(";")[0].trim());
}

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

const RequestUploadBody = z.object({
  name: z.string().optional(),
  size: z.number().optional(),
  contentType: z.string(),
});

// ─── POST /farmops/storage/request-upload-url ─────────────────────────────────

router.post(
  "/farmops/storage/request-upload-url",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const parsed = RequestUploadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType } = parsed.data;

    if (size != null && size > MAX_UPLOAD_SIZE_BYTES) {
      res.status(400).json({ error: "File too large. Maximum 10 MB." });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (error) {
      console.error("[farmops-products] Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  }
);

// ─── GET /farmops/products ────────────────────────────────────────────────────

router.get("/farmops/products", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;

  const products = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      productType: productsTable.productType,
      pricingType: productsTable.pricingType,
      priceInCents: productsTable.priceInCents,
      unitLabel: productsTable.unitLabel,
      isOnSale: productsTable.isOnSale,
      salePriceCents: productsTable.salePriceCents,
      availability: productsTable.availability,
      displayOrder: productsTable.displayOrder,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .where(eq(productsTable.tenantId, tenantId))
    .orderBy(asc(productsTable.displayOrder), desc(productsTable.createdAt));

  // Attach image count per product
  const imageCounts = await db
    .select({ productId: productImagesTable.productId, cnt: count() })
    .from(productImagesTable)
    .groupBy(productImagesTable.productId);

  const countMap = new Map(imageCounts.map((r) => [r.productId, r.cnt]));

  res.json(products.map((p) => ({ ...p, imageCount: countMap.get(p.id) ?? 0 })));
});

// ─── POST /farmops/products ───────────────────────────────────────────────────

router.post(
  "/farmops/products",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = ProductBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { name, description, productType, pricingType, priceInCents, unitLabel,
      depositDescription, isOnSale, salePriceCents, availability, displayOrder } = parsed.data;

    const [product] = await db
      .insert(productsTable)
      .values({
        tenantId,
        name,
        description,
        productType,
        pricingType,
        priceInCents,
        unitLabel: unitLabel ?? null,
        depositDescription: depositDescription ?? null,
        isOnSale: isOnSale ?? false,
        salePriceCents: salePriceCents ?? null,
        availability,
        displayOrder,
      })
      .returning();

    res.status(201).json(product);
  }
);

// ─── PATCH /farmops/products/:id ──────────────────────────────────────────────

router.patch(
  "/farmops/products/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid product ID" }); return; }
    const { id } = parsed.data;

    const bodyParsed = ProductUpdateBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const [existing] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Product not found" }); return; }

    const updates = bodyParsed.data;

    const [updated] = await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.id, id))
      .returning();

    res.json(updated);
  }
);

// ─── DELETE /farmops/products/:id ─────────────────────────────────────────────

router.delete(
  "/farmops/products/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid product ID" }); return; }
    const { id } = parsed.data;

    const [existing] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Product not found" }); return; }

    // Block deletion if any orders reference this product
    const [{ usageCount }] = await db
      .select({ usageCount: count() })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.productId, id));

    if (usageCount > 0) {
      res.status(409).json({
        error: "Cannot delete a product that has been ordered. Disable it instead.",
      });
      return;
    }

    // Fetch and fire-and-forget delete GCS images before deleting product
    const images = await db
      .select({ objectKey: productImagesTable.objectKey })
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, id));

    await db.delete(productsTable).where(eq(productsTable.id, id));

    for (const img of images) {
      deleteStorageObject(img.objectKey).catch((err) =>
        console.error("[farmops-products] Failed to delete image from storage:", err)
      );
    }

    res.status(204).send();
  }
);

// ─── GET /farmops/products/:id/images ─────────────────────────────────────────

router.get("/farmops/products/:id/images", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid product ID" }); return; }
  const { id } = parsed.data;

  const [product] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId)))
    .limit(1);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const images = await db
    .select()
    .from(productImagesTable)
    .where(eq(productImagesTable.productId, id))
    .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id));

  res.json(images);
});

// ─── POST /farmops/products/:id/images ────────────────────────────────────────

router.post(
  "/farmops/products/:id/images",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid product ID" }); return; }
    const { id } = parsed.data;

    const [product] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId)))
      .limit(1);
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }

    const bodyParsed = AddImageBody.safeParse(req.body);
    if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

    if (!isAllowedMimeType(bodyParsed.data.contentType)) {
      res.status(400).json({ error: "Only JPEG, PNG, and WebP images are allowed." });
      return;
    }

    const [{ imageCount }] = await db
      .select({ imageCount: count() })
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, id));

    if (imageCount >= 5) {
      res.status(400).json({ error: "Maximum of 5 images per product." });
      return;
    }

    const { objectPath, altText } = bodyParsed.data;
    const url = `/api/storage${objectPath}`;

    const [image] = await db
      .insert(productImagesTable)
      .values({
        productId: id,
        objectKey: objectPath,
        url,
        sortOrder: imageCount,
        altText: altText ?? null,
      })
      .returning();

    res.status(201).json(image);
  }
);

// ─── DELETE /farmops/products/:id/images/:imageId ─────────────────────────────

router.delete(
  "/farmops/products/:id/images/:imageId",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const parsed = imageIdParam.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
    const { id, imageId } = parsed.data;

    // Verify product belongs to tenant
    const [product] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId)))
      .limit(1);
    if (!product) { res.status(404).json({ error: "Product not found" }); return; }

    const [image] = await db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.id, imageId))
      .limit(1);

    if (!image || image.productId !== id) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    await db.delete(productImagesTable).where(eq(productImagesTable.id, imageId));

    deleteStorageObject(image.objectKey).catch((err) =>
      console.error("[farmops-products] Failed to delete image from storage:", err)
    );

    res.status(204).send();
  }
);

export default router;
