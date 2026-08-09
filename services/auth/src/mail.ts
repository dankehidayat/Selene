import { Resend } from "resend";

function getFrom(): string {
  const raw = (process.env.RESEND_FROM || "Selene <onboarding@resend.dev>").trim();
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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn("[auth-mail] RESEND_API_KEY is not set; email not sent.");
    return { ok: false, error: "RESEND_API_KEY_MISSING" };
  }
  try {
    const client = new Resend(key);
    const { data, error } = await client.emails.send({
      from: getFrom(),
      to,
      subject,
      html,
      text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const url = passwordResetLink(rawToken);
  return sendEmail(
    to,
    "Selene — Reset your password",
    `<p>Hi,</p><p>Click the link to choose a new password for your Selene account (valid 60 minutes):</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    `Reset your Selene password here: ${url}`,
  );
}

export function sendElevationCode(
  to: string,
  code: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return sendEmail(
    to,
    "Selene — Admin confirmation code",
    `<p>Your one-time confirmation code for admin elevation is:</p><p><strong style="font-size:1.4em">${code}</strong></p><p>It expires in 10 minutes.</p>`,
    `Your Selene admin confirmation code is: ${code}`,
  );
}