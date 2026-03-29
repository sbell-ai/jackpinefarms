/**
 * Email sending utility for Jack Pine Farm.
 *
 * To enable real email delivery:
 *   1. Set SENDGRID_API_KEY (SendGrid) or SMTP_HOST + SMTP_USER + SMTP_PASS (SMTP/Mailgun/etc.)
 *   2. Set EMAIL_FROM to the sender address (e.g. "Jack Pine Farm <hello@jackpinefarm.ca>")
 *
 * Until credentials are configured, emails are logged to the console (safe for dev/staging).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  provider: "sendgrid" | "smtp" | "stub";
  error?: string;
}

async function sendViaSendGrid(msg: EmailMessage, apiKey: string, from: string): Promise<void> {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }] }],
      from: { email: from },
      reply_to: msg.replyTo ? { email: msg.replyTo } : undefined,
      subject: msg.subject,
      content: [
        { type: "text/plain", value: msg.text },
        ...(msg.html ? [{ type: "text/html", value: msg.html }] : []),
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SendGrid error ${response.status}: ${detail}`);
  }
}

async function sendViaSmtp(msg: EmailMessage, from: string): Promise<void> {
  const host = process.env.SMTP_HOST!;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;

  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const nodemailer = require("nodemailer");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({ from, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text, html: msg.html });
}

/**
 * Send a transactional email.
 * Automatically selects the best available provider:
 *   1. SendGrid (SENDGRID_API_KEY)
 *   2. SMTP (SMTP_HOST + SMTP_USER + SMTP_PASS)
 *   3. Stub — logs to console (no credentials configured)
 */
export async function sendEmail(msg: EmailMessage): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM ?? "Jack Pine Farm <noreply@jackpinefarm.ca>";

  if (process.env.SENDGRID_API_KEY) {
    try {
      await sendViaSendGrid(msg, process.env.SENDGRID_API_KEY, from);
      return { sent: true, provider: "sendgrid" };
    } catch (err: any) {
      console.error("[EMAIL] SendGrid failed:", err.message);
      return { sent: false, provider: "sendgrid", error: err.message };
    }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await sendViaSmtp(msg, from);
      return { sent: true, provider: "smtp" };
    } catch (err: any) {
      console.error("[EMAIL] SMTP failed:", err.message);
      return { sent: false, provider: "smtp", error: err.message };
    }
  }

  console.log(
    `[EMAIL STUB] No email provider configured. Set SENDGRID_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.\n` +
    `  To: ${msg.to}\n` +
    `  Subject: ${msg.subject}\n` +
    `  Body: ${msg.text.slice(0, 200)}${msg.text.length > 200 ? "…" : ""}`
  );
  return { sent: false, provider: "stub" };
}
