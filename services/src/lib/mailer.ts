// ============================================================================
// mailer.ts - Email service (nodemailer + SMTP)
// ============================================================================
// Provider-agnostic SMTP abstraction:
//   Dev:  Mailtrap (sandbox - no real send)
//   Prod: AWS SES SMTP (cheapest at scale, $0.10/1000) - Amazon/Netflix use
//         Resend SMTP   (modern API, React Email - Stripe/Linear use)
//         Postmark      (deliverability focused - Vercel/Cal.com use)
//
// Switch provider = just change env vars, code unchanged. That's the win.
//
// For HIGH VOLUME (>1M emails/day): direct provider SDK (AWS SES API,
// Resend SDK) faster than SMTP. SMTP fine up to ~100k/day.
// ============================================================================

import nodemailer, { type Transporter } from "nodemailer";
import { env, isDev } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ServiceUnavailableError } from "../utils/errors.js";

// ============================================================================
// Transporter singleton
// ============================================================================
let transporterInstance: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporterInstance) return transporterInstance;

  // nodemailer "service" shortcut: SMTP_SERVICE=gmail auto-sets host/port/secure
  // If SMTP_SERVICE not provided → fall back to manual host/port config (SES/Resend/Mailtrap)
  // Industry: providers with known SMTP endpoints use shortcuts (gmail/yahoo/hotmail/outlook)
  const useServiceShortcut = Boolean(env.SMTP_SERVICE);

  transporterInstance = nodemailer.createTransport({
    ...(useServiceShortcut
      ? { service: env.SMTP_SERVICE }
      : {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE, // true for 465, false for 587/STARTTLS
        }),
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,

    // Connection pool - same connection reuse for multiple sends
    // High throughput ke liye essential - new TCP per email = slow
    pool: true,
    maxConnections: 5,
    maxMessages: 100,

    // Timeouts - hanging connections prevent
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,

    // Dev me debug logs - prod me off
    logger: isDev,
    debug: false,
  });

  // Verify on startup - SMTP creds wrong ho to early fail
  // Background me - boot block na ho
  const transportInfo = useServiceShortcut
    ? { service: env.SMTP_SERVICE }
    : { host: env.SMTP_HOST, port: env.SMTP_PORT };

  void transporterInstance.verify().then(
    () => logger.info(transportInfo, "Mailer: SMTP transport ready"),
    (err) => logger.error({ err, ...transportInfo }, "Mailer: SMTP verify failed"),
  );

  return transporterInstance;
}

// ============================================================================
// SendEmail interface
// ============================================================================
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string; // Plaintext fallback - some clients/spam filters prefer
  replyTo?: string;
  // Idempotency key - duplicate send avoid for queue retries
  messageId?: string;
}

// ============================================================================
// sendEmail - core send function
// ============================================================================
// Production usage: queue ke through call (BullMQ worker)
// Direct call only for synchronous flows (sign-up confirmation immediately)
// ============================================================================
export async function sendEmail(opts: SendEmailOptions): Promise<{ messageId: string }> {
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: Array.isArray(opts.to) ? opts.to.join(",") : opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? stripHtml(opts.html),
      replyTo: opts.replyTo,
      messageId: opts.messageId,
    });

    logger.info({ messageId: info.messageId, to: opts.to, subject: opts.subject }, "Email sent");
    return { messageId: info.messageId };
  } catch (err) {
    // Translate SMTP errors into actionable diagnostics
    const smtpErr = err as { code?: string; responseCode?: number; response?: string };
    const code = smtpErr.code;
    const responseCode = smtpErr.responseCode;

    let hint = "Unknown SMTP error";
    if (code === "EAUTH" || responseCode === 535) {
      // Gmail-specific: most common cause is wrong password type
      hint = env.SMTP_SERVICE === "gmail"
        ? "Gmail authentication failed. You must use an APP PASSWORD, not your regular Gmail password. " +
          "Generate one at https://myaccount.google.com/apppasswords (2FA must be enabled first). " +
          "SMTP_USER = your full @gmail.com address, SMTP_PASSWORD = 16-char App Password."
        : "SMTP authentication failed - check SMTP_USER and SMTP_PASSWORD in .env";
    } else if (code === "ECONNECTION" || code === "ETIMEDOUT") {
      const host = env.SMTP_SERVICE ? `(service: ${env.SMTP_SERVICE})` : `${env.SMTP_HOST}:${env.SMTP_PORT}`;
      hint = `Cannot reach SMTP host ${host} - check network/firewall`;
    } else if (code === "EENVELOPE") {
      hint = "Invalid sender or recipient address - for Gmail, EMAIL_FROM must match SMTP_USER";
    }

    logger.error(
      { err, code, responseCode, to: opts.to, subject: opts.subject, hint },
      "Email send failed",
    );

    // Throw typed error - 503 (not 500), retryable-by-design
    throw new ServiceUnavailableError(`Email service unavailable: ${hint}`);
  }
}

// ============================================================================
// HTML → plaintext fallback (rudimentary - good enough for transactional)
// Production grade: use `html-to-text` package
// ============================================================================
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// Graceful shutdown
// ============================================================================
export async function closeMailer(): Promise<void> {
  if (transporterInstance) {
    transporterInstance.close();
    logger.info("Mailer: closed");
  }
}
