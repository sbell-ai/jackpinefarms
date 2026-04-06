import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { db, farmopsSmsMessagesTable, farmopsSubscriptionAddonsTable } from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { sendSms } from "../lib/sms.js";

const router: IRouter = Router();

const SMS_MAX_CHARS = 1600;
const SMS_MAX_RECIPIENTS = 100;

const idParam = z.object({ id: z.coerce.number().int().positive() });

// ── Addon gate helper ─────────────────────────────────────────────────────────
// Checks whether the current tenant has an active sms_notifications add-on row.

async function hasSmsAddon(tenantId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: farmopsSubscriptionAddonsTable.id })
    .from(farmopsSubscriptionAddonsTable)
    .where(
      and(
        eq(farmopsSubscriptionAddonsTable.tenantId, tenantId),
        eq(farmopsSubscriptionAddonsTable.addonType, "sms_notifications")
      )
    )
    .limit(1);
  return Boolean(row);
}

// ── POST /farmops/sms/send ────────────────────────────────────────────────────
// Requires active sms_notifications add-on.
// Body: { recipients: string[], message: string }
// Returns: { sent: number, failed: number, results: [...] }

const SendBody = z.object({
  recipients: z
    .array(z.string().min(1))
    .min(1, "At least one recipient is required")
    .max(SMS_MAX_RECIPIENTS, `Maximum ${SMS_MAX_RECIPIENTS} recipients per send`),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(SMS_MAX_CHARS, `Message cannot exceed ${SMS_MAX_CHARS} characters`),
});

router.post(
  "/farmops/sms/send",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenant = req.farmopsTenant!;

    if (!(await hasSmsAddon(tenant.id))) {
      res.status(403).json({
        error: "addon_required",
        requiredAddon: "sms_notifications",
        message: "The SMS notifications add-on is required for this feature.",
      });
      return;
    }

    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { recipients, message } = parsed.data;

    let sentCount = 0;
    let failedCount = 0;

    const results: Array<{ to: string; status: "sent" | "failed"; sid?: string; error?: string }> = [];

    for (const to of recipients) {
      const result = await sendSms({ to, body: message });

      const status: "sent" | "failed" = result.sent ? "sent" : "failed";

      await db.insert(farmopsSmsMessagesTable).values({
        tenantId:     tenant.id,
        toPhone:      to,
        body:         message,
        status,
        twilioSid:    result.sid ?? null,
        errorMessage: result.error ?? null,
      });

      if (result.sent) {
        sentCount++;
      } else {
        failedCount++;
      }

      results.push({ to, status, sid: result.sid, error: result.error });
    }

    req.log.info({ tenantId: tenant.id, sent: sentCount, failed: failedCount }, "FarmOps SMS batch sent");
    res.json({ sent: sentCount, failed: failedCount, results });
  }
);

// ── GET /farmops/sms/messages ─────────────────────────────────────────────────
// Returns paginated SMS message log for the tenant, newest first.
// Query params: limit (default 50, max 200), offset (default 0)

const ListQuery = z.object({
  limit:  z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/farmops/sms/messages",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenant = req.farmopsTenant!;

    if (!(await hasSmsAddon(tenant.id))) {
      res.status(403).json({
        error: "addon_required",
        requiredAddon: "sms_notifications",
        message: "The SMS notifications add-on is required for this feature.",
      });
      return;
    }

    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }

    const { limit, offset } = parsed.data;

    const messages = await db
      .select()
      .from(farmopsSmsMessagesTable)
      .where(eq(farmopsSmsMessagesTable.tenantId, tenant.id))
      .orderBy(desc(farmopsSmsMessagesTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(messages);
  }
);

// ── GET /farmops/sms/status ───────────────────────────────────────────────────
// Returns whether the tenant has the SMS add-on active and Twilio is configured.

router.get(
  "/farmops/sms/status",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenant = req.farmopsTenant!;
    const addonActive = await hasSmsAddon(tenant.id);
    const twilioConfigured = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );
    res.json({ addonActive, twilioConfigured });
  }
);

export default router;
