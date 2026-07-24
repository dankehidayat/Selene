// apps/backend/src/totp.ts
import crypto from "node:crypto";
import {
  generateSecret as otpGenerateSecret,
  generateURI,
  verifySync,
} from "otplib";
import bcrypt from "bcryptjs";

const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET || "selene-secret";
  return crypto.createHash("sha256").update(`selene-totp:${secret}`).digest();
}

/** Encrypt TOTP secret for DB storage. */
export function encryptTotpSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptTotpSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function generateTotpSecret(): string {
  return otpGenerateSecret();
}

export function totpUri(email: string, secret: string): string {
  const issuer = process.env.TOTP_ISSUER || "Selene";
  return generateURI({
    issuer,
    label: email,
    secret,
  });
}

export function verifyTotpCode(secret: string, token: string): boolean {
  try {
    const result = verifySync({
      secret,
      token: token.replace(/\s/g, ""),
    });
    return Boolean(result?.valid);
  } catch {
    return false;
  }
}

/** Generate 8 human-readable backup codes; return plain + bcrypt hashes. */
export async function generateBackupCodes(): Promise<{
  plain: string[];
  hashes: string[];
}> {
  const plain: string[] = [];
  for (let i = 0; i < 8; i++) {
    plain.push(crypto.randomBytes(4).toString("hex"));
  }
  const hashes = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  return { plain, hashes };
}

export async function consumeBackupCode(
  code: string,
  hashesJson: string | null | undefined,
): Promise<{ ok: boolean; remainingHashes: string | null }> {
  if (!hashesJson) return { ok: false, remainingHashes: null };
  let hashes: string[];
  try {
    hashes = JSON.parse(hashesJson) as string[];
  } catch {
    return { ok: false, remainingHashes: null };
  }
  const normalized = code.trim().toLowerCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      const remaining = hashes.filter((_, j) => j !== i);
      return {
        ok: true,
        remainingHashes: remaining.length ? JSON.stringify(remaining) : null,
      };
    }
  }
  return { ok: false, remainingHashes: hashesJson };
}
