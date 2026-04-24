/**
 * Scheduled job: send trial-expiry reminder emails.
 *
 * Runs once per hour after server startup. Finds all tenants whose trial
 * ends within the next 3 days and who have not yet received a reminder
 * (trial_reminder_sent_at IS NULL), sends them an email, and marks the
 * reminder as sent.
 *
 * The job is fire-and-forget — errors are logged but never rethrow.
 */

import { db, farmopsTenantsTable } from "@workspace/db";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { sendEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";

const JOB_INTERVAL_MS = 60 * 60 * 1000;

async function sendTrialReminders(): Promise<void> {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const tenantsToRemind = await db
    .select({
      id:          farmopsTenantsTable.id,
      name:        farmopsTenantsTable.name,
      ownerEmail:  farmopsTenantsTable.ownerEmail,
      trialEndsAt: farmopsTenantsTable.trialEndsAt,
    })
    .from(farmopsTenantsTable)
    .where(
      and(
        eq(farmopsTenantsTable.status, "trialing"),
        gte(farmopsTenantsTable.trialEndsAt, now),
        lt(farmopsTenantsTable.trialEndsAt, in3Days),
        isNull(farmopsTenantsTable.trialReminderSentAt)
      )
    );

  if (tenantsToRemind.length === 0) return;

  logger.info({ count: tenantsToRemind.length }, "[trial-reminders] Sending trial expiry reminders");

  for (const tenant of tenantsToRemind) {
    const daysLeft = Math.ceil(
      (tenant.trialEndsAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const daysText = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
    const trialEndFormatted = tenant.trialEndsAt!.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

    await sendEmail({
      to: tenant.ownerEmail,
      subject: `Your JP FarmOps trial ends in ${daysText}`,
      text: [
        `Hi,`,
        ``,
        `This is a reminder that your JP FarmOps trial for ${tenant.name} ends on ${trialEndFormatted} (${daysText} remaining).`,
        ``,
        `To continue using JP FarmOps without interruption, please subscribe before your trial ends.`,
        ``,
        `If you have any questions, reply to this email and we'll be happy to help.`,
        ``,
        `— The JP FarmOps Team`,
      ].join("\n"),
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Georgia,serif;color:#2d2d2d;background:#faf9f7;margin:0;padding:0;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e5e0d8;border-radius:8px;overflow:hidden;">
    <div style="background:#2c4a2e;color:#fff;padding:28px 32px;">
      <h1 style="margin:0;font-size:22px;font-weight:normal;">JP FarmOps</h1>
      <p style="margin:4px 0 0;font-size:14px;opacity:.75;">Trial expiry notice</p>
    </div>
    <div style="padding:32px;">
      <p>Hi,</p>
      <p>Your JP FarmOps trial for <strong>${tenant.name}</strong> ends on <strong>${trialEndFormatted}</strong> — that's <strong>${daysText}</strong> from now.</p>
      <p>To continue using JP FarmOps without interruption, please subscribe before your trial ends.</p>
      <p>If you have any questions, simply reply to this email and we'll be happy to help.</p>
      <p style="margin-top:32px;">— The JP FarmOps Team</p>
    </div>
  </div>
</body>
</html>`,
    })
      .then((r) => {
        if (!r.sent) {
          logger.warn({ tenantId: tenant.id, provider: r.provider, error: r.error }, "[trial-reminders] Email delivery failed");
        }
      })
      .catch((err: unknown) => {
        logger.warn({ err, tenantId: tenant.id }, "[trial-reminders] Unexpected error sending reminder");
      });

    await db
      .update(farmopsTenantsTable)
      .set({ trialReminderSentAt: new Date() })
      .where(eq(farmopsTenantsTable.id, tenant.id))
      .catch((err: unknown) => {
        logger.warn({ err, tenantId: tenant.id }, "[trial-reminders] Failed to mark reminder sent");
      });
  }
}

export function startTrialReminderJob(): void {
  setInterval(() => {
    sendTrialReminders().catch((err: unknown) => {
      logger.warn({ err }, "[trial-reminders] Job error");
    });
  }, JOB_INTERVAL_MS);

  logger.info(`[trial-reminders] Job scheduled every ${JOB_INTERVAL_MS / 60000} minutes`);
}
