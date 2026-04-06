/**
 * SMS sending utility for FarmOps.
 *
 * To enable real SMS delivery via Twilio:
 *   1. Set TWILIO_ACCOUNT_SID  — your Twilio Account SID (starts with AC...)
 *   2. Set TWILIO_AUTH_TOKEN   — your Twilio Auth Token
 *   3. Set TWILIO_FROM_NUMBER  — your Twilio phone number (e.g. "+15551234567")
 *
 * Until credentials are configured, SMS messages are logged to the console
 * and the function returns { sent: false, provider: "stub" }. This is safe
 * for development and staging environments.
 */

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SendSmsResult {
  sent: boolean;
  provider: "twilio" | "stub";
  sid?: string;
  error?: string;
}

/**
 * Send an SMS message.
 * Uses Twilio when TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are set.
 * Falls back to a console-log stub when credentials are absent.
 */
export async function sendSms(msg: SmsMessage): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (accountSid && authToken && fromNumber) {
    try {
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      const twilio = require("twilio");
      const client = twilio(accountSid, authToken);

      const result = await client.messages.create({
        body: msg.body,
        from: fromNumber,
        to:   msg.to,
      });

      return { sent: true, provider: "twilio", sid: result.sid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SMS] Twilio error:", message);
      return { sent: false, provider: "twilio", error: message };
    }
  }

  console.log(
    `[SMS STUB] No Twilio credentials configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.\n` +
    `  To: ${msg.to}\n` +
    `  Body: ${msg.body.slice(0, 160)}${msg.body.length > 160 ? "…" : ""}`
  );
  return { sent: true, provider: "stub" };
}
