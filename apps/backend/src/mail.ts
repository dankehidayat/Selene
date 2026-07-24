// apps/backend/src/mail.ts
import { Resend } from "resend";

function getFrom(): string {
  return process.env.RESEND_FROM || "Selene <onboarding@resend.dev>";
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

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<{ ok: boolean; devLogged?: boolean }> {
  const resetUrl = passwordResetLink(rawToken);
  const key = process.env.RESEND_API_KEY?.trim();

  if (!key) {
    console.warn(
      "[mail] RESEND_API_KEY is not set — logging reset URL (dev only):",
      resetUrl,
    );
    return { ok: true, devLogged: true };
  }

  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: getFrom(),
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
    console.error("[mail] Resend error:", error);
    throw new Error(error.message || "Failed to send email");
  }

  return { ok: true };
}
