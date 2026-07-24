// apps/backend/src/mail.ts
import { Resend } from "resend";

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

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<{ ok: boolean; id?: string; devLogged?: boolean }> {
  const resetUrl = passwordResetLink(rawToken);
  const key = process.env.RESEND_API_KEY?.trim();
  const from = getFrom();
  const status = getMailConfigStatus();

  if (!key) {
    console.warn(
      "[mail] RESEND_API_KEY is not set in this process.",
      "Check apps/backend/.env inside the container:",
      "`docker exec selene-backend printenv RESEND_API_KEY`.",
      "Compose must not override env_file with an empty RESEND_API_KEY.",
      "Reset URL (dev only):",
      resetUrl,
    );
    // Fail in non-local deployments so the UI/API surfaces misconfiguration
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
    `[mail] Sending password reset via Resend → ${to} from=${from} app=${status.appPublicUrl}`,
  );

  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Reset your Selene password",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; line-height: 1.5; color: #111;">
        <h2 style="margin: 0 0 12px;">Reset your password</h2>
        <p>We received a request to reset the password for your Selene account.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">
            Choose a new password
          </a>
        </p>
        <p style="font-size: 13px; color: #555;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
        <p style="font-size: 12px; color: #888; word-break: break-all;">${resetUrl}</p>
      </div>
    `,
    text: `Reset your Selene password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
  });

  if (error) {
    console.error("[mail] Resend error:", JSON.stringify(error));
    // Common Resend free-tier restriction
    const msg = error.message || "Failed to send email";
    throw new Error(msg);
  }

  console.info("[mail] Resend accepted message", data?.id ?? "(no id)");
  return { ok: true, id: data?.id };
}
