import { Router, type IRouter } from "express";
import { eq, asc, ne, and } from "drizzle-orm";
import { db, productsTable, notifyMeTable } from "@workspace/db";
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
        `<p>Good news! <strong>${productName}</strong> is now taking orders at Jack Pine Farm.</p>`,
        `<p><a href="${shopUrl}">Place your order →</a></p>`,
        `<hr />`,
        `<p style="font-size:12px;color:#888">`,
        `<a href="${unsubscribeUrl}">Unsubscribe</a> from restock notifications for ${productName}.`,
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

  res.json(ListProductsResponse.parse(products));
});

router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = {
    ...parsed.data,
    description: sanitizeDescription(parsed.data.description) ?? parsed.data.description,
  };

  const [product] = await db.insert(productsTable).values(data).returning();

  res.status(201).json(GetProductResponse.parse(product));
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

  res.json(GetProductResponse.parse(product));
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

  const updateData = {
    ...parsed.data,
    ...(parsed.data.description !== undefined && {
      description: sanitizeDescription(parsed.data.description) ?? parsed.data.description,
    }),
    updatedAt: new Date(),
  };

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

  res.json(UpdateProductResponse.parse(product));
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
