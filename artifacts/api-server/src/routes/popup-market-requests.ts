import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, popupMarketRequestsTable } from "@workspace/db";
import { requirePlatformAdmin } from "../middlewares/require-platform-admin.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";

const router: IRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateRequestBody = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  eventLocation: z.string().min(1, "Event location is required"),
  phone: z.string().optional(),
  organization: z.string().optional(),
  preferredDate: z.string().optional(),
  alternateDate: z.string().optional(),
  estimatedAttendees: z.string().optional(),
  eventType: z.string().optional(),
  productsInterested: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
});

const ListRequestsQuery = z.object({
  status: z.enum(["new", "in_review", "confirmed", "declined"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const UpdateRequestBody = z.object({
  status: z.enum(["new", "in_review", "confirmed", "declined"]).optional(),
  adminNotes: z.string().nullable().optional(),
});

// POST /popup-market-requests — public
router.post("/popup-market-requests", async (req, res): Promise<void> => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const {
    name, email, eventLocation, phone, organization,
    preferredDate, alternateDate, estimatedAttendees,
    eventType, productsInterested, notes,
  } = parsed.data;

  const [row] = await db
    .insert(popupMarketRequestsTable)
    .values({
      name,
      email,
      eventLocation,
      phone: phone ?? null,
      organization: organization ?? null,
      preferredDate: preferredDate ?? null,
      alternateDate: alternateDate ?? null,
      estimatedAttendees: estimatedAttendees ?? null,
      eventType: eventType ?? null,
      productsInterested,
      notes: notes ?? null,
      status: "new",
    })
    .returning();

  logger.info({ id: row!.id, email }, "popup_market_request_created");

  res.status(201).json(row);
});

// GET /admin/popup-market-requests — protected
router.get("/admin/popup-market-requests", requirePlatformAdmin, async (req, res): Promise<void> => {
  const parsed = ListRequestsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }

  const { status, page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const where = status ? eq(popupMarketRequestsTable.status, status) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(popupMarketRequestsTable)
      .where(where)
      .orderBy(desc(popupMarketRequestsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(popupMarketRequestsTable)
      .where(where),
  ]);

  res.json({ data: rows, total: Number(totalRow!.value), page, limit });
});

// GET /admin/popup-market-requests/:id — protected
router.get("/admin/popup-market-requests/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select()
    .from(popupMarketRequestsTable)
    .where(eq(popupMarketRequestsTable.id, id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Popup market request not found" });
    return;
  }

  res.json(row);
});

// PATCH /admin/popup-market-requests/:id — protected
router.patch("/admin/popup-market-requests/:id", requirePlatformAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const [existing] = await db
    .select({ id: popupMarketRequestsTable.id })
    .from(popupMarketRequestsTable)
    .where(eq(popupMarketRequestsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Popup market request not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates["status"] = parsed.data.status;
  if (parsed.data.adminNotes !== undefined) updates["adminNotes"] = parsed.data.adminNotes;

  const [updated] = await db
    .update(popupMarketRequestsTable)
    .set(updates)
    .where(eq(popupMarketRequestsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
