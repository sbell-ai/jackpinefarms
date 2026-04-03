import { Router, type IRouter } from "express";
import { eq, asc, ne, and, inArray } from "drizzle-orm";
import { db, productsTable, productImagesTable, notifyMeTable } from "@workspace/db";
import {
  ListProductsResponse,
  CreateProductBody,
  GetProductParams,
  GetProductResponse,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  SubscribeNotifyMeParams,
  SubscribeNotifyMeBody,
  SubscribeNotifyMeResponse,
  ListProductsQueryParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/require-admin";
import { generateUnsubscribeToken } from "./notify-me.js";
import { sendEmail } from "../lib/email.js";
import sanitizeHtml from "sanitize-html";

const ALLOWED_HTML: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "h2", "h3"],
  allowedAttributes: {},
  allowedSchemes: [],
};

function sanitizeDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return sanitizeHtml(raw, ALLOWED_HTML).trim() || null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const router: IRouter = Router();

const BASE_URL = process.env.PUBLIC_URL ?? "http://localhost:8080";

async function triggerNotifyMeEmails(productId: number, productName: string): Promise<void> {
  const subscribers = await db
    .select()
    .from(notifyMeTable)
    .where(
      and(
        eq(notifyMeTable.productId, productId),
        eq(notifyMeTable.globalUnsubscribe, false)
      )
    );

  if (subscribers.length === 0) return;

  const shopUrl = `${BASE_URL}/shop?product=${productId}`;
  let sentCount = 0;

  for (const sub of subscribers) {
    const unsubscribeUrl = `${BASE_URL}/unsubscribe?token=${sub.unsubscribeToken}`;
    const result = await sendEmail({
      to: sub.email,
      subject: `${productName} is now available — Jack Pine Farm`,
      text: [
        `Good news! ${productName} is now taking orders at Jack Pine Farm.`,
        ``,
        `Order here: ${shopUrl}`,
        ``,
        `—`,
        `Jack Pine Farm`,
        `To unsubscribe from these notifications: ${unsubscribeUrl}`,
      ].join("\n"),
      html: [
        `<p>Good news! <strong>${escapeHtml(productName)}</strong> is now taking orders at Jack Pine Farm.</p>`,
        `<p><a href="${shopUrl}">Place your order →</a></p>`,
        `<hr />`,
        `<p style="font-size:12px;color:#888">`,
        `<a href="${unsubscribeUrl}">Unsubscribe</a> from restock notifications for ${escapeHtml(productName)}.`,
        `</p>`,
      ].join("\n"),
    });
    if (result.sent) sentCount++;
  }

  console.log(`[NOTIFY-ME] Processed ${subscribers.length} restock notification(s) for "${productName}" (${sentCount} delivered, provider: ${sentCount > 0 ? "live" : "stub"})`);
}

router.get("/products", async (req, res): Promise<void> => {
  const queryParsed = ListProductsQueryParams.safeParse(req.query);
  const includeDisabled = queryParsed.success && queryParsed.data.includeDisabled === true;

  const products = await db
    .select()
    .from(productsTable)
    .where(includeDisabled ? undefined : ne(productsTable.availability, "disabled"))
    .orderBy(asc(productsTable.displayOrder), asc(productsTable.id));

  const productIds = products.map((p) => p.id);
  const allImages =
    productIds.length > 0
      ? await db
          .select()
          .from(productImagesTable)
          .where(inArray(productImagesTable.productId, productIds))
          .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id))
      : [];

  const imagesByProductId = new Map<number, typeof allImages>();
  for (const img of allImages) {
    if (!imagesByProductId.has(img.productId))
      imagesByProductId.set(img.productId, []);
    imagesByProductId.get(img.productId)!.push(img);
  }

  const productsWithImages = products.map((p) => {
    let images = imagesByProductId.get(p.id) ?? [];
    if (images.length === 0 && p.imageUrl) {
      images = [
        {
          id: 0,
          productId: p.id,
          objectKey: "",
          url: p.imageUrl,
          sortOrder: 0,
          altText: null,
          createdAt: p.createdAt,
        },
      ];
    }
    return { ...p, images };
  });

  res.json(ListProductsResponse.parse(productsWithImages));
});

router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cleanedDescription = sanitizeDescription(parsed.data.description);
  if (!cleanedDescription) {
    res.status(400).json({ error: "Description is required and must contain allowed content." });
    return;
  }

  const data = { ...parsed.data, description: cleanedDescription };

  const [product] = await db.insert(productsTable).values(data).returning();

  res.status(201).json(GetProductResponse.parse({ ...product, images: [] }));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProductParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  let images = await db
    .select()
    .from(productImagesTable)
    .where(eq(productImagesTable.productId, params.data.id))
    .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id));

  if (images.length === 0 && product.imageUrl) {
    images = [
      {
        id: 0,
        productId: product.id,
        objectKey: "",
        url: product.imageUrl,
        sortOrder: 0,
        altText: null,
        createdAt: product.createdAt,
      },
    ];
  }

  res.json(GetProductResponse.parse({ ...product, images }));
});

router.patch("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProductParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (parsed.data.description !== undefined) {
    const cleanedDescription = sanitizeDescription(parsed.data.description);
    if (!cleanedDescription) {
      res.status(400).json({ error: "Description is required and must contain allowed content." });
      return;
    }
    parsed.data.description = cleanedDescription;
  }

  // Enforce sale price invariant using merged state (update fields + existing)
  const effectiveOnSale = parsed.data.isOnSale ?? existing.isOnSale;
  const effectiveSalePrice = "salePriceCents" in parsed.data ? parsed.data.salePriceCents : existing.salePriceCents;
  const effectivePrice = parsed.data.priceInCents ?? existing.priceInCents;
  if (effectiveOnSale) {
    if (effectiveSalePrice == null || effectiveSalePrice <= 0) {
      res.status(400).json({ error: "Sale price must be greater than $0 when on sale" });
      return;
    }
    if (effectiveSalePrice >= effectivePrice) {
      res.status(400).json({ error: "Sale price must be less than the regular price" });
      return;
    }
  }

  const updateData = { ...parsed.data, updatedAt: new Date() };

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (
    existing.availability === "sold_out" &&
    parsed.data.availability === "taking_orders"
  ) {
    triggerNotifyMeEmails(product.id, product.name).catch((err) =>
      console.error("Error sending restock notifications:", err)
    );
  }

  let patchImages = await db
    .select()
    .from(productImagesTable)
    .where(eq(productImagesTable.productId, params.data.id))
    .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id));

  if (patchImages.length === 0 && product.imageUrl) {
    const [migrated] = await db
      .insert(productImagesTable)
      .values({
        productId: product.id,
        objectKey: "",
        url: product.imageUrl,
        sortOrder: 1,
        altText: null,
      })
      .returning();
    patchImages = [migrated];
  }

  res.json(UpdateProductResponse.parse({ ...product, images: patchImages }));
});

router.post("/products/:id/notify-me", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SubscribeNotifyMeParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SubscribeNotifyMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const unsubscribeToken = generateUnsubscribeToken();

  await db
    .insert(notifyMeTable)
    .values({
      productId: params.data.id,
      email: parsed.data.email,
      unsubscribeToken,
    })
    .onConflictDoNothing();

  res.json(SubscribeNotifyMeResponse.parse({ message: "You're on the list!" }));
});

export default router;
