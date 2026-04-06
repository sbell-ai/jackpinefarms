import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { db, farmopsSmsMessagesTable, farmopsSubscriptionAddonsTable } from "@workspace/db";
import {
  requireFarmopsTenant,
  requireFarmopsAddon,
} from "../middlewares/require-farmops-tenant.js";
import { sendSms } from "../lib/sms.js";

const router: IRouter = Router();

const SMS_MAX_CHARS = 1600;
const SMS_MAX_RECIPIENTS = 100;

// E.164 format: optional leading + followed by 7–15 significant digits
const E164_RE = /^\+?[1-9]\d{6,14}$/;

function isValidPhone(phone: string): boolean {
  return E164_RE.test(phone.replace(/[\s\-().]/g, ""));
}

// ── POST /farmops/sms/send ────────────────────────────────────────────────────
// Requires active sms_notifications add-on (enforced by middleware).
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
  requireFarmopsAddon("sms_notifications"),
  async (req, res): Promise<void> => {
    const tenant = req.farmopsTenant!;

    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    const { recipients, message } = parsed.data;

    // Validate all phone numbers before sending anything
    const invalidPhones = recipients.filter((r) => !isValidPhone(r));
    if (invalidPhones.length > 0) {
      res.status(400).json({
        error: `Invalid phone number${invalidPhones.length > 1 ? "s" : ""}: ${invalidPhones.slice(0, 5).join(", ")}`,
      });
      return;
    }

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

      if (result.sent) sentCount++;
      else failedCount++;

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
  requireFarmopsAddon("sms_notifications"),
  async (req, res): Promise<void> => {
    const tenant = req.farmopsTenant!;

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
// Not gated on the addon itself — the SMS page uses this to decide what to show.

router.get(
  "/farmops/sms/status",
  requireFarmopsTenant,
  async (req, res): Promise<void> => {
    const tenant = req.farmopsTenant!;

    const [row] = await db
      .select({ id: farmopsSubscriptionAddonsTable.id })
      .from(farmopsSubscriptionAddonsTable)
      .where(
        and(
          eq(farmopsSubscriptionAddonsTable.tenantId, tenant.id),
          eq(farmopsSubscriptionAddonsTable.addonType, "sms_notifications")
        )
      )
      .limit(1);

    const addonActive = Boolean(row);
    const twilioConfigured = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );

    res.json({ addonActive, twilioConfigured });
  }
);

export default router;
