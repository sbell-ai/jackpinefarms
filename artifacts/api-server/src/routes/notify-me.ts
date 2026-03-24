import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, notifyMeTable, productsTable } from "@workspace/db";
import * as z from "zod";
import crypto from "node:crypto";

const router: IRouter = Router();

const UnsubscribeBody = z.object({
  token: z.string().min(1),
  globalUnsubscribe: z.boolean().optional(),
});

function generateUnsubscribeToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export { generateUnsubscribeToken };

router.get("/unsubscribe", async (req, res): Promise<void> => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: "Token is required" }); return; }

  const [sub] = await db
    .select()
    .from(notifyMeTable)
    .where(eq(notifyMeTable.unsubscribeToken, token))
    .limit(1);

  if (!sub) { res.status(404).json({ error: "Invalid unsubscribe token" }); return; }

  const [product] = await db
    .select({ name: productsTable.name })
    .from(productsTable)
    .where(eq(productsTable.id, sub.productId))
    .limit(1);

  res.json({
    email: sub.email,
    productName: product?.name ?? null,
    globalUnsubscribe: sub.globalUnsubscribe,
    token,
  });
});

router.post("/unsubscribe", async (req, res): Promise<void> => {
  const parsed = UnsubscribeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { token, globalUnsubscribe } = parsed.data;

  const [sub] = await db
    .select()
    .from(notifyMeTable)
    .where(eq(notifyMeTable.unsubscribeToken, token))
    .limit(1);

  if (!sub) { res.status(404).json({ error: "Invalid unsubscribe token" }); return; }

  if (globalUnsubscribe) {
    await db
      .update(notifyMeTable)
      .set({ globalUnsubscribe: true })
      .where(eq(notifyMeTable.email, sub.email));
    res.json({ message: "You have been globally unsubscribed from all notifications" });
  } else {
    await db
      .delete(notifyMeTable)
      .where(eq(notifyMeTable.unsubscribeToken, token));
    res.json({ message: "You have been unsubscribed from this product's notifications" });
  }
});

router.post("/resubscribe", async (req, res): Promise<void> => {
  const parsed = UnsubscribeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { token } = parsed.data;

  const [sub] = await db
    .select()
    .from(notifyMeTable)
    .where(eq(notifyMeTable.unsubscribeToken, token))
    .limit(1);

  if (!sub) { res.status(404).json({ error: "Invalid unsubscribe token" }); return; }

  await db
    .update(notifyMeTable)
    .set({ globalUnsubscribe: false })
    .where(eq(notifyMeTable.unsubscribeToken, token));

  res.json({ message: "You have been re-subscribed to notifications" });
});

export default router;
