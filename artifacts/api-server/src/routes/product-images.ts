import { Router, type IRouter } from "express";
import { eq, asc, count } from "drizzle-orm";
import { db, productsTable, productImagesTable } from "@workspace/db";
import { GetProductParams } from "@workspace/api-zod";
import { requirePlatformAdmin } from "../middlewares/require-admin.js";
import { deleteStorageObject } from "../lib/objectStorage.js";
import * as z from "zod";

const AddProductImageBody = z.object({
  objectPath: z.string(),
  contentType: z.string().optional(),
  altText: z.string().optional(),
});

const ReorderProductImagesBody = z.object({
  imageIds: z.array(z.number()),
});

const router: IRouter = Router();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isAllowedMimeType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return ALLOWED_MIME_TYPES.has(contentType.toLowerCase().split(";")[0].trim());
}

router.get(
  "/admin/products/:productId/images",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const productId = parseInt(req.params["productId"] as string, 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const images = await db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, productId))
      .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id));

    res.json(images);
  }
);

router.post(
  "/admin/products/:productId/images",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const params = GetProductParams.safeParse({
      id: parseInt(req.params["productId"] as string, 10),
    });
    if (!params.success) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, params.data.id))
      .limit(1);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const parsed = AddProductImageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (!isAllowedMimeType(parsed.data.contentType)) {
      res.status(400).json({
        error: "Only JPEG, PNG, and WebP images are allowed.",
      });
      return;
    }

    const [{ imageCount }] = await db
      .select({ imageCount: count() })
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, params.data.id));

    if (imageCount >= 5) {
      res.status(400).json({ error: "Maximum of 5 images per product." });
      return;
    }

    const { objectPath, altText } = parsed.data;
    const url = `/api/storage${objectPath}`;

    const [image] = await db
      .insert(productImagesTable)
      .values({
        productId: params.data.id,
        objectKey: objectPath,
        url,
        sortOrder: imageCount,
        altText: altText ?? null,
      })
      .returning();

    res.status(201).json(image);
  }
);

router.delete(
  "/admin/products/:productId/images/:imageId",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const productId = parseInt(req.params["productId"] as string, 10);
    const imageId = parseInt(req.params["imageId"] as string, 10);

    if (isNaN(productId) || isNaN(imageId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [image] = await db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.id, imageId))
      .limit(1);

    if (!image || image.productId !== productId) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    await db
      .delete(productImagesTable)
      .where(eq(productImagesTable.id, imageId));

    deleteStorageObject(image.objectKey).catch((err) =>
      console.error("[product-images] Failed to delete from storage:", err)
    );

    res.json({ message: "Image deleted." });
  }
);

router.patch(
  "/admin/products/:productId/images/reorder",
  requirePlatformAdmin,
  async (req, res): Promise<void> => {
    const productId = parseInt(req.params["productId"] as string, 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const parsed = ReorderProductImagesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { imageIds } = parsed.data;

    const existingImages = await db
      .select({ id: productImagesTable.id })
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, productId));

    const ownedIds = new Set(existingImages.map((img) => img.id));
    const allOwned = imageIds.every((id) => ownedIds.has(id));
    if (!allOwned || imageIds.length !== ownedIds.size) {
      res.status(400).json({ error: "Invalid image IDs for this product." });
      return;
    }

    await Promise.all(
      imageIds.map((id, index) =>
        db
          .update(productImagesTable)
          .set({ sortOrder: index })
          .where(eq(productImagesTable.id, id))
      )
    );

    const images = await db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, productId))
      .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id));

    res.json(images);
  }
);

export default router;
