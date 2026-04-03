import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db, contactSubmissionsTable } from "@workspace/db";
import { sendEmail } from "../lib/email.js";
import { requirePlatformAdmin } from "../middlewares/require-platform-admin.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please wait a minute and try again." },
});

const contactBodySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(3, "Subject must be at least 3 characters").max(120, "Subject is too long"),
  message: z.string().min(10, "Message must be at least 10 characters").max(3000, "Message is too long (max 3000 characters)"),
  company: z.string().optional(),
});

router.post("/contact", contactLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = contactBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    res.status(400).json({ error: firstError?.message ?? "Invalid request" });
    return;
  }

  const { name, email, subject, message, company } = parsed.data;

  const ip = (() => {
    const forwarded = req.headers["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(",")[0] ?? req.ip ?? "");
    return raw.trim();
  })();
  const userAgent = req.headers["user-agent"] ?? null;

  if (company) {
    try {
      await db.insert(contactSubmissionsTable).values({
        name,
        email,
        subject,
        message,
        ip: ip || null,
        userAgent,
        status: "failed",
      });
    } catch {
      // ignore persistence errors for honeypot
    }
    res.json({ ok: true });
    return;
  }

  logger.info({ name, email: email.replace(/(?<=.{2}).(?=.*@)/g, "*"), subject }, "contact_received");

  const contactTo = process.env.CONTACT_TO_EMAIL;
  const contactFrom = process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER;

  let emailResult: { sent: boolean; provider?: string; error?: string } = { sent: false };

  if (!contactTo) {
    logger.info({ subject }, "[CONTACT STUB] CONTACT_TO_EMAIL not set — submission not delivered.");
  }

  if (contactTo) {
    const text = [
      `New contact message from ${name} <${email}>`,
      `Subject: ${subject}`,
      ``,
      message,
      ``,
      `---`,
      `Sent from jackpinefarms.farm/contact`,
      `IP: ${ip || "unknown"}`,
    ].join("\n");

    const html = `
      <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <hr>
      <div style="white-space:pre-wrap">${escapeHtml(message)}</div>
      <hr>
      <p style="color:#888;font-size:12px">Sent from jackpinefarms.farm/contact &mdash; IP: ${escapeHtml(ip || "unknown")}</p>
    `;

    emailResult = await sendEmail({
      to: contactTo,
      from: contactFrom,
      subject: `[Contact] ${subject}`,
      text,
      html,
      replyTo: email,
    });
  }

  const status = emailResult.sent ? "sent" : "failed";
  const errorSummary = emailResult.error ? emailResult.error.slice(0, 500) : undefined;

  if (contactTo) {
    if (emailResult.sent) {
      logger.info({ provider: emailResult.provider, subject }, "contact_send_success");
    } else {
      logger.warn({ provider: emailResult.provider, subject, smtpError: errorSummary }, "contact_send_failed");
    }
  }

  try {
    await db.insert(contactSubmissionsTable).values({
      name,
      email,
      subject,
      message,
      ip: ip || null,
      userAgent,
      status,
      error: errorSummary ?? null,
    });
  } catch (dbErr) {
    logger.error({ err: dbErr }, "[CONTACT] Failed to persist submission");
  }

  if (contactTo && !emailResult.sent) {
    res.status(500).json({ error: "Failed to send message. Please try again." });
    return;
  }

  res.json({ ok: true });
});

router.get("/contact/submissions", requirePlatformAdmin, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: contactSubmissionsTable.id,
      name: contactSubmissionsTable.name,
      email: contactSubmissionsTable.email,
      subject: contactSubmissionsTable.subject,
      status: contactSubmissionsTable.status,
      error: contactSubmissionsTable.error,
      createdAt: contactSubmissionsTable.createdAt,
    })
    .from(contactSubmissionsTable)
    .orderBy(desc(contactSubmissionsTable.createdAt))
    .limit(20);

  res.json(rows);
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default router;
