import { Router, type IRouter } from "express";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db, expensesTable, insertExpenseSchema } from "@workspace/db";
import { requireAdmin } from "../middlewares/require-admin.js";

const router: IRouter = Router();

const listQuery = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  category: z.string().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

router.get("/admin/expenses", requireAdmin, async (req, res): Promise<void> => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { fromDate, toDate, category } = parsed.data;
  const conditions = [];
  if (fromDate) conditions.push(gte(expensesTable.date, fromDate));
  if (toDate) conditions.push(lte(expensesTable.date, toDate));
  if (category) conditions.push(eq(expensesTable.category, category));

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expensesTable.date), desc(expensesTable.createdAt));

  res.json(expenses);
});

router.get("/admin/expenses/summary", requireAdmin, async (req, res): Promise<void> => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { fromDate, toDate } = parsed.data;
  const conditions = [];
  if (fromDate) conditions.push(gte(expensesTable.date, fromDate));
  if (toDate) conditions.push(lte(expensesTable.date, toDate));

  const rows = await db
    .select({
      category: expensesTable.category,
      totalCents: sql<number>`SUM(${expensesTable.amountCents})::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(expensesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(expensesTable.category)
    .orderBy(desc(sql`SUM(${expensesTable.amountCents})`));

  const grandTotal = rows.reduce((s, r) => s + (r.totalCents ?? 0), 0);

  res.json({ byCategory: rows, totalCents: grandTotal });
});

router.post("/admin/expenses", requireAdmin, async (req, res): Promise<void> => {
  const parsed = insertExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [expense] = await db.insert(expensesTable).values(parsed.data).returning();
  res.status(201).json(expense);
});

router.patch("/admin/expenses/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid expense ID" });
    return;
  }

  const parsed = insertExpenseSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [expense] = await db
    .update(expensesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(expensesTable.id, params.data.id))
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json(expense);
});

router.delete("/admin/expenses/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = idParam.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid expense ID" });
    return;
  }

  const [deleted] = await db
    .delete(expensesTable)
    .where(eq(expensesTable.id, params.data.id))
    .returning({ id: expensesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json({ message: "Expense deleted" });
});

export default router;
