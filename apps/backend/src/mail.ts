// apps/backend/src/mail.ts
import { Resend } from "resend";
import {
  passwordResetEmail,
  welcomeEmail,
  codeEmail,
} from "./emailTemplates";

function getFrom(): string {
  // Strip wrapping quotes that .env files sometimes keep
  const raw = (
    process.env.RESEND_FROM || "Selene <onboarding@resend.dev>"
  ).trim();
  return raw.replace(/^["']|["']$/g, "");
}

function getPublicAppUrl(): string {
  return (
    process.env.APP_PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

export function passwordResetLink(rawToken: string): string {
  return `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/** Safe diagnostics (never logs the API key). */
export function getMailConfigStatus(): {
  hasApiKey: boolean;
  from: string;
  appPublicUrl: string;
} {
  return {
    hasApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    from: getFrom(),
    appPublicUrl: getPublicAppUrl(),
  };
}

/**
 * Shared Resend send with graceful no-key handling.
 * - No API key + local/dev → resolves `{ ok: true, devLogged: true }` (the link
 *   or code is logged instead of emailed).
 * - No API key + non-local → throws so misconfiguration surfaces.
 * - API key present → sends and returns the Resend message id.
 */
async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Extra context logged when the key is missing (dev only). */
  devHint?: string;
}): Promise<{ ok: boolean; id?: string; devLogged?: boolean }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = getFrom();
  const status = getMailConfigStatus();

  if (!key) {
    console.warn(
      "[mail] RESEND_API_KEY is not set in this process.",
      "Check apps/backend/.env inside the container:",
      "`docker exec selene-backend printenv RESEND_API_KEY`.",
      opts.devHint ?? "",
    );
    const isLocal =
      status.appPublicUrl.includes("localhost") ||
      status.appPublicUrl.includes("127.0.0.1");
    if (isLocal || process.env.ALLOW_DEV_MAIL_LOG === "true") {
      return { ok: true, devLogged: true };
    }
    throw new Error(
      "Email is not configured: RESEND_API_KEY is missing in the backend process",
    );
  }

  console.info(
    `[mail] Sending "${opts.subject}" via Resend → ${opts.to} from=${from} app=${status.appPublicUrl}`,
  );

  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) {
    console.error("[mail] Resend error:", JSON.stringify(error));
    throw new Error(error.message || "Failed to send email");
  }

  console.info("[mail] Resend accepted message", data?.id ?? "(no id)");
  return { ok: true, id: data?.id };
}

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<{ ok: boolean; id?: string; devLogged?: boolean }> {
  const resetUrl = passwordResetLink(rawToken);
  const { html, text } = passwordResetEmail({ resetUrl });
  return sendViaResend({
    to,
    subject: "Reset your Selene password",
    html,
    text,
    devHint: `Reset URL (dev only): ${resetUrl}`,
  });
}

export async function sendWelcomeEmail(
  to: string,
  name?: string | null,
): Promise<{ ok: boolean; id?: string; devLogged?: boolean }> {
  const { html, text } = welcomeEmail({ name, appUrl: getPublicAppUrl() });
  return sendViaResend({
    to,
    subject: "Welcome to Selene",
    html,
    text,
  });
}

export async function sendCodeEmail(
  to: string,
  code: string,
  opts: { heading: string; intro: string; expiryNote: string },
): Promise<{ ok: boolean; id?: string; devLogged?: boolean }> {
  const { html, text } = codeEmail({ code, ...opts });
  return sendViaResend({
    to,
    subject: "Your Selene confirmation code",
    html,
    text,
    devHint: `Confirmation code (dev only): ${code}`,
  });
}
