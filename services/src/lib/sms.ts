// ============================================================================
// sms.ts - SMS service (provider-agnostic, mirrors mailer.ts)
// ============================================================================
// Provider switch via SMS_PROVIDER env:
//   "console" (dev)  → logs the message to the terminal, NO real send.
//                       Zero config — phone OTP works locally immediately.
//   "twilio"  (prod) → Twilio REST API via fetch (NO SDK dependency, keeps
//                       node_modules lean). Set TWILIO_* env vars.
//
// Switch provider = change env only, code unchanged (same as mailer pattern).
//
// Other providers (AWS SNS, MSG91, Vonage) can be added as new branches — the
// public `sendSms()` signature stays stable.
// ============================================================================

import { env, isDev } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ServiceUnavailableError } from "../utils/errors.js";

export interface SendSmsInput {
  /** E.164 destination, e.g. "+919876543210" */
  to: string;
  /** Message body (already rendered) */
  body: string;
}

// ============================================================================
// Twilio transport - REST API via fetch (no `twilio` npm package needed)
// ============================================================================
// POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
// Basic auth: AccountSID:AuthToken. Body is x-www-form-urlencoded.
// Sender: prefer Messaging Service SID (MG...) if set, else From number.
// ============================================================================
async function sendViaTwilio(input: SendSmsInput): Promise<void> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new ServiceUnavailableError(
      "SMS provider is misconfigured (missing Twilio credentials)",
    );
  }
  if (!env.TWILIO_MESSAGING_SERVICE_SID && !env.TWILIO_FROM_NUMBER) {
    throw new ServiceUnavailableError(
      "SMS provider is misconfigured (no Twilio sender configured)",
    );
  }

  const form = new URLSearchParams();
  form.set("To", input.to);
  form.set("Body", input.body);
  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    form.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    form.set("From", env.TWILIO_FROM_NUMBER!);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  // Basic auth header - base64("sid:token")
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    // Twilio returns JSON error { code, message, ... }
    let detail = `HTTP ${res.status}`;
    try {
      const json = (await res.json()) as { message?: string; code?: number };
      if (json?.message) detail = `${json.message} (code ${json.code})`;
    } catch {
      /* non-JSON body - keep HTTP status */
    }
    logger.error({ to: input.to, detail }, "Twilio SMS send failed");
    throw new ServiceUnavailableError("Could not send SMS - please try again");
  }
}

// ============================================================================
// Console transport - dev only. Logs the OTP so devs can verify without SMS.
// ============================================================================
function sendViaConsole(input: SendSmsInput): void {
  // Bright, hard-to-miss log block for local dev
  logger.info(
    { to: input.to },
    `\n──────────── SMS (dev console) ────────────\n  To:   ${input.to}\n  Body: ${input.body}\n───────────────────────────────────────────`,
  );
}

// ============================================================================
// sendSms - public API (provider-agnostic)
// ============================================================================
export async function sendSms(input: SendSmsInput): Promise<void> {
  if (env.SMS_PROVIDER === "twilio") {
    await sendViaTwilio(input);
    logger.info({ to: input.to }, "SMS sent (twilio)");
    return;
  }

  // Default: console transport (dev). Guard against silent prod misuse.
  if (!isDev) {
    logger.warn(
      { to: input.to },
      "SMS_PROVIDER=console in non-dev environment - OTP only logged, not delivered",
    );
  }
  sendViaConsole(input);
}
