// apps/backend/src/emailTemplates.ts
//
// Selene transactional email templates — bold, modern, brand-matched.
// Table-based layout + inline CSS for maximum email-client compatibility
// (Gmail / Outlook / Apple Mail), with a small <style> block that refines the
// layout on narrow screens where supported. Every builder returns { html, text }.

const ACCENT = "#2E8BFF";
const ACCENT_DARK = "#1F6FE0";
const INK = "#0F172A";
const HEADLINE = "#0F172A";
const BODY = "#475569";
const MUTED = "#94A3B8";
const CANVAS = "#F1F5F9";
const CARD = "#FFFFFF";
const HAIRLINE = "#E2E8F0";
const FONT =
  "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface EmailParts {
  html: string;
  text: string;
}

/* ── Inline building blocks ─────────────────────────────────────────── */

const headline = (t: string) =>
  `<h1 class="h1" style="margin:0 0 12px;font-family:${FONT};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${HEADLINE};">${t}</h1>`;

const para = (html: string, marginTop = 0) =>
  `<p style="margin:${marginTop}px 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${BODY};">${html}</p>`;

const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr><td align="center" bgcolor="${ACCENT}" style="border-radius:10px;background:${ACCENT};"><a href="${href}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${label}</a></td></tr></table>`;

const fallbackLink = (href: string) =>
  `<p style="margin:14px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all;">If the button doesn't work, open this link:<br/><a href="${href}" target="_blank" style="color:${ACCENT_DARK};text-decoration:underline;">${href}</a></p>`;

const codeBox = (code: string) =>
  `<div class="code" style="margin:26px 0 6px;padding:22px 16px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;text-align:center;"><span class="codeval" style="font-family:${FONT};font-size:32px;font-weight:700;letter-spacing:10px;color:${INK};">${code}</span></div>`;

/* ── Shell ──────────────────────────────────────────────────────────── */

function shell(opts: {
  preheader: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>Selene</title>
<style>
  @media (max-width: 600px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .h1 { font-size: 22px !important; }
    .codeval { font-size: 24px !important; letter-spacing: 6px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CANVAS};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;">
          <tr>
            <td style="background:${CARD};border:1px solid ${HAIRLINE};border-radius:16px;">
              <!-- Header band -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="px" style="background:${INK};padding:26px 32px;border-radius:16px 16px 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family:${FONT};font-size:21px;font-weight:700;letter-spacing:-0.02em;color:#FFFFFF;">Selene</td>
                        <td align="right" style="font-family:${FONT};font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#94A3B8;">Energy &amp; Climate</td>
                      </tr>
                    </table>
                    <div style="height:3px;width:42px;background:${ACCENT};border-radius:2px;margin-top:14px;font-size:0;line-height:0;">&nbsp;</div>
                  </td>
                </tr>
              </table>
              <!-- Body -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="px" style="padding:32px;">
                    ${opts.bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="px" align="center" style="padding:22px 32px 0;">
              ${
                opts.footerNote
                  ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">${opts.footerNote}</p>`
                  : ""
              }
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">Selene &mdash; Smart Energy &amp; Climate</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ── Variants ───────────────────────────────────────────────────────── */

export function passwordResetEmail(opts: { resetUrl: string }): EmailParts {
  const { resetUrl } = opts;
  const html = shell({
    preheader: "Reset your Selene password",
    bodyHtml:
      headline("Reset your password") +
      para(
        "We received a request to reset the password for your Selene account. Choose a new password below to get back in.",
      ) +
      button(resetUrl, "Choose a new password") +
      fallbackLink(resetUrl),
    footerNote:
      "This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.",
  });
  const text = [
    "Reset your Selene password",
    "",
    "We received a request to reset the password for your Selene account.",
    "",
    `Choose a new password: ${resetUrl}`,
    "",
    "This link expires in 1 hour. If you didn't request this, ignore this email.",
  ].join("\n");
  return { html, text };
}

export function welcomeEmail(opts: {
  name?: string | null;
  appUrl: string;
}): EmailParts {
  const title = opts.name ? `Welcome, ${opts.name}` : "Welcome to Selene";
  const html = shell({
    preheader: "Your Selene account is ready",
    bodyHtml:
      headline(title) +
      para(
        "Your account is ready. Start monitoring your energy and climate data, track usage over time, and see exactly where the power goes.",
      ) +
      button(opts.appUrl, "Open dashboard"),
    footerNote:
      "You're receiving this because a Selene account was created with this email address.",
  });
  const text = [
    title,
    "",
    "Your Selene account is ready. Start monitoring your energy and climate data.",
    "",
    `Open the dashboard: ${opts.appUrl}`,
  ].join("\n");
  return { html, text };
}

export function codeEmail(opts: {
  code: string;
  heading: string;
  intro: string;
  expiryNote: string;
}): EmailParts {
  const html = shell({
    preheader: `Your Selene confirmation code: ${opts.code}`,
    bodyHtml:
      headline(opts.heading) +
      para(opts.intro) +
      codeBox(opts.code) +
      para(
        "Enter this code to continue. If you didn't request it, you can ignore this email.",
        18,
      ),
    footerNote: opts.expiryNote,
  });
  const text = [
    opts.heading,
    "",
    opts.intro,
    "",
    `Your code: ${opts.code}`,
    "",
    opts.expiryNote,
  ].join("\n");
  return { html, text };
}
