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

  for (const sub of subscribers) {
    const unsubscribeUrl = `${BASE_URL}/unsubscribe?token=${sub.unsubscribeToken}`;
    console.log(
      `[EMAIL STUB] Restock notification for ${sub.email}:\n` +
      `  Product: ${productName} is now taking orders!\n` +
      `  Link: ${BASE_URL}/shop\n` +
      `  Unsubscribe: ${unsubscribeUrl}`
    );
  }

  console.log(`[NOTIFY-ME] Sent ${subscribers.length} restock notification(s) for "${productName}"`);
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

  const [product] = await db.insert(productsTable).values(parsed.data).returning();

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

  const [product] = await db
    .update(productsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
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
