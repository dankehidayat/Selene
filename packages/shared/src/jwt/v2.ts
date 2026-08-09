/**
 * JWT v2 — EdDSA (Ed25519) token signing/verification + JWKS export.
 *
 * Contract (see docs/openapi-v1.yml and Selene-mobile/docs/MOBILE_API.md):
 *  - Algorithm: EdDSA over Ed25519
 *  - Key ID (kid): selene-v2-2026
 *  - Issuer: selene-auth-v2
 *  - Audience: selene-api-gateway
 *  - Access token TTL: 15 minutes
 *  - Refresh token TTL: 30 days, one-time use (rotation enforced by the auth
 *    service via the `fid` family id + `jti` per-token nonce)
 *  - Public JWKS published at /.well-known/jwks.json
 *
 * Key sourcing (first match wins):
 *   1. `JWT_V2_PRIVATE_KEY` env — PKCS#8 PEM, or base64url/base64 DER
 *      (single-line) which is normalized to PEM
 *   2. `JWT_V2_KEY_FILE` env — path to a PKCS#8 PEM file (or DER)
 *   3. Auto-generate (development only) and cache in memory. Persist the
 *      printed PKCS#8 to a file before long-lived services.
 */
import {
  SignJWT,
  jwtVerify,
  generateKeyPair,
  importPKCS8,
  exportJWK,
  type CryptoKey,
} from "jose";
import { readFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";
import { randomUUID } from "node:crypto";
import type { UserRole } from "../types/auth";

export const JWT_V2_ALG = "EdDSA";
export const JWT_V2_KID = "selene-v2-2026";
export const JWT_V2_ISSUER = "selene-auth-v2";
export const JWT_V2_AUDIENCE = "selene-api-gateway";
export const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

export interface AccessTokenClaims {
  sub: string; // userId
  email: string;
  role: UserRole;
  sid: string; // session id
}

export interface RefreshTokenClaims {
  sub: string; // userId
  sid: string; // session id
  fid: string; // refresh token family (rotation group) id
}

export interface JwtV2KeyPair {
  /** PKCS#8 PEM, used to seed other instances (deploy). */
  privateKeyPem: string;
  /** jose CryptoKey used for signing. */
  privateKey: CryptoKey;
  /** Public JWK (kid set) used for verification + JWKS. */
  publicJwk: Record<string, unknown>;
}

let cachedKeyPair: JwtV2KeyPair | null = null;
let keyLoadError: string | null = null;

function normalizePrivateKeyPem(raw: string): string {
  const value = raw.trim();
  if (value.includes("-----BEGIN")) return value;
  // Accept base64url / base64 DER (single-line) and wrap it as PKCS#8 PEM.
  const der = Buffer.from(value, "base64url");
  const b64 = der.toString("base64").match(/.{1,64}/g)?.join("\n") ?? der.toString("base64");
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
}

function readPrivateKeyPem(): string | null {
  const fromEnv = process.env.JWT_V2_PRIVATE_KEY;
  if (fromEnv?.trim()) return normalizePrivateKeyPem(fromEnv);
  const fromFile = process.env.JWT_V2_KEY_FILE;
  if (fromFile) return normalizePrivateKeyPem(readFileSync(fromFile, "utf8"));
  return null;
}

async function loadOrGenerateKeyPair(): Promise<JwtV2KeyPair> {
  const pem = readPrivateKeyPem();
  if (pem) {
    const privateKey = await importPKCS8(pem, JWT_V2_ALG);
    // Derive the public key from the same private key via Node KeyObject so the
    // exported JWK always corresponds to the signing key.
    const keyObject = createPublicKey(pem);
    const publicJwk = await exportJWK(keyObject);
    publicJwk.alg = JWT_V2_ALG;
    publicJwk.use = "sig";
    publicJwk.kid = JWT_V2_KID;
    return { privateKeyPem: pem, privateKey, publicJwk };
  }

  // Development fallback: generate + keep in memory.
  const { publicKey, privateKey } = await generateKeyPair(
    JWT_V2_ALG as "Ed25519",
    { extractable: true },
  );
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = JWT_V2_ALG;
  publicJwk.use = "sig";
  publicJwk.kid = JWT_V2_KID;
  console.warn(
    "[jwt-v2] No JWT_V2_PRIVATE_KEY/JWT_V2_KEY_FILE set — generated ephemeral " +
      "Ed25519 key for development. Tokens will not survive restarts.",
  );
  return { privateKeyPem: "", privateKey, publicJwk };
}

export async function getKeyPair(): Promise<JwtV2KeyPair> {
  if (keyLoadError) throw new Error(keyLoadError);
  if (!cachedKeyPair) cachedKeyPair = await loadOrGenerateKeyPair();
  return cachedKeyPair;
}

/** Explicit reset (tests, key rotation at runtime). */
export function resetJwtV2Cache(): void {
  cachedKeyPair = null;
  keyLoadError = null;
}

/** Set a fixed key for deterministic tests. */
export async function usePrivateKeyPem(pem: string): Promise<void> {
  resetJwtV2Cache();
  const privateKey = await importPKCS8(pem, JWT_V2_ALG);
  const keyObject = createPublicKey(pem);
  const publicJwk = await exportJWK(keyObject);
  publicJwk.alg = JWT_V2_ALG;
  publicJwk.use = "sig";
  publicJwk.kid = JWT_V2_KID;
  cachedKeyPair = { privateKeyPem: pem, privateKey, publicJwk };
}

export interface SignAccessOptions {
  /** Unique id for the session (also embedded in refresh tokens). */
  sessionId?: string;
  /** Manual issued-at override (tests). */
  iat?: number;
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  options?: SignAccessOptions,
): Promise<string> {
  const { privateKey } = await getKeyPair();
  const iat = options?.iat ?? Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: claims.email,
    role: claims.role,
    sid: options?.sessionId ?? claims.sid,
  })
    .setProtectedHeader({ alg: JWT_V2_ALG, typ: "JWT", kid: JWT_V2_KID })
    .setSubject(claims.sub)
    .setIssuer(JWT_V2_ISSUER)
    .setAudience(JWT_V2_AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TOKEN_TTL)
    .sign(privateKey);
}

export async function signRefreshToken(
  claims: RefreshTokenClaims,
  options?: { iat?: number },
): Promise<string> {
  const { privateKey } = await getKeyPair();
  const iat = options?.iat ?? Math.floor(Date.now() / 1000);
  const jti = randomUUID();
  return new SignJWT({
    fid: claims.fid,
    sid: claims.sid,
  })
    .setProtectedHeader({ alg: JWT_V2_ALG, typ: "JWT", kid: JWT_V2_KID })
    .setSubject(claims.sub)
    .setIssuer(JWT_V2_ISSUER)
    .setAudience(JWT_V2_AUDIENCE)
    .setJti(jti)
    .setIssuedAt(iat)
    .setExpirationTime(iat + REFRESH_TOKEN_TTL)
    .sign(privateKey);
}

export type AccessTokenPayload = AccessTokenClaims & {
  jti?: string;
  iat?: number;
  exp?: number;
};

export type RefreshTokenPayload = RefreshTokenClaims & {
  jti: string;
  iat?: number;
  exp?: number;
};

export interface VerifyResult<T> {
  valid: boolean;
  payload: T;
  reason?: string;
}

/** Verifies an access token. Never throws; returns `valid` + payload/reason. */
export async function verifyAccessToken(
  token: string,
): Promise<VerifyResult<AccessTokenPayload>> {
  try {
    const { publicJwk } = await getKeyPair();
    const { payload } = await jwtVerify(token, publicJwk, {
      issuer: JWT_V2_ISSUER,
      audience: JWT_V2_AUDIENCE,
      algorithms: [JWT_V2_ALG],
    });
    if (!payload.sub || typeof payload.sid !== "string") {
      return { valid: false, payload: payload as unknown as AccessTokenPayload, reason: "missing claims" };
    }
    return { valid: true, payload: payload as unknown as AccessTokenPayload };
  } catch (error) {
    return { valid: false, payload: {} as AccessTokenPayload, reason: (error as Error).message };
  }
}

/** Verifies a refresh token (auth service only). Never throws. */
export async function verifyRefreshToken(
  token: string,
): Promise<VerifyResult<RefreshTokenPayload>> {
  try {
    const { publicJwk } = await getKeyPair();
    const { payload } = await jwtVerify(token, publicJwk, {
      issuer: JWT_V2_ISSUER,
      audience: JWT_V2_AUDIENCE,
      algorithms: [JWT_V2_ALG],
    });
    if (!payload.sub || !payload.jti) {
      return { valid: false, payload: payload as unknown as RefreshTokenPayload, reason: "missing claims" };
    }
    return { valid: true, payload: payload as unknown as RefreshTokenPayload };
  } catch (error) {
    return { valid: false, payload: {} as RefreshTokenPayload, reason: (error as Error).message };
  }
}

/** JWKS payload for the /.well-known/jwks.json endpoint. */
export async function getJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  const { publicJwk } = await getKeyPair();
  return { keys: [publicJwk] };
}
