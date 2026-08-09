import { SignJWT, jwtVerify } from "jose";
import { JWT_V2_ALG, JWT_V2_KID, getKeyPair } from "@selene/shared/jwt/v2";

type Purpose = "2fa_pending" | "2fa_setup";

interface TokenData {
  userId: string;
  email?: string;
  role?: string;
  secret?: string;
}

async function getPair() {
  return getKeyPair();
}

/** Sign a short-lived purpose-scoped token signed with the Ed25519 service key. */
export async function signActionToken(
  purpose: Purpose,
  data: TokenData,
  ttl: number,
): Promise<string> {
  const { privateKey } = await getPair();
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT({
    purpose,
    email: data.email,
    role: data.role,
    secret: data.secret,
  })
    .setProtectedHeader({ alg: JWT_V2_ALG, typ: "JWT", kid: JWT_V2_KID })
    .setSubject(data.userId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ttl)
    .sign(privateKey);
}

/** Resolve and validate an action token; null when invalid/expired/wrong purpose. */
export async function resolveActionToken(
  token: string,
  expected: Purpose,
): Promise<TokenData | null> {
  try {
    const { publicJwk } = await getPair();
    const { payload } = await jwtVerify(token, publicJwk, {
      algorithms: [JWT_V2_ALG],
    });
    if (payload.purpose !== expected || !payload.sub) return null;
    return {
      userId: payload.sub,
      email: payload.email ? String(payload.email) : undefined,
      role: payload.role ? String(payload.role) : undefined,
      secret: payload.secret ? String(payload.secret) : undefined,
    };
  } catch {
    return null;
  }
}

export const PENDING_2FA_TTL = 5 * 60; // 5 minutes
export const SETUP_2FA_TTL = 10 * 60; // 10 minutes

export function signPending2faToken(user: {
  id: string;
  email: string;
  role: string;
}): Promise<string> {
  return signActionToken(
    "2fa_pending",
    { userId: user.id, email: user.email, role: user.role },
    PENDING_2FA_TTL,
  );
}

export function resolvePending2fa(
  token: string,
): Promise<TokenData | null> {
  return resolveActionToken(token, "2fa_pending");
}

export function signSetup2faToken(
  userId: string,
  secret: string,
): Promise<string> {
  return signActionToken("2fa_setup", { userId, secret }, SETUP_2FA_TTL);
}

export function resolveSetup2fa(
  token: string,
): Promise<TokenData | null> {
  return resolveActionToken(token, "2fa_setup");
}