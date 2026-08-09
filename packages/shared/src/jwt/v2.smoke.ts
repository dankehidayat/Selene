/**
 * Smoke: JWT v2 (EdDSA/Ed25519) sign/verify + JWKS contract.
 * bun run packages/shared/src/jwt/v2.smoke.ts
 */
import { generateKeyPair, exportPKCS8 } from "jose";
import {
  usePrivateKeyPem,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getJwks,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  JWT_V2_KID,
  JWT_V2_ALG,
} from "../index";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const { privateKey } = await generateKeyPair("Ed25519", { extractable: true });
const pem = await exportPKCS8(privateKey);
await usePrivateKeyPem(pem);

const access = await signAccessToken({
  sub: "usr_1",
  email: "a@b.c",
  role: "USER",
  sid: "sess_1",
});
const a = await verifyAccessToken(access);
assert(a.valid, "access token verifies");
assert(a.payload.role === "USER" && a.payload.sid === "sess_1", "access claims");
assert(ACCESS_TOKEN_TTL === 900, "access TTL = 15m");

const rt = await signRefreshToken({ sub: "usr_1", sid: "sess_1", fid: "fam_1" });
const v = await verifyRefreshToken(rt);
assert(v.valid, "refresh token verifies");
assert(v.payload.jti && v.payload.fid === "fam_1", "refresh rotation claims");
assert(REFRESH_TOKEN_TTL === 2592000, "refresh TTL = 30d");

const misused = await verifyRefreshToken(access);
assert(!misused.valid, "refresh verification rejects access tokens");

const jwks = await getJwks();
assert(jwks.keys.length === 1, "jwks has one key");
assert(jwks.keys[0].kid === JWT_V2_KID, "jwks kid");
assert(jwks.keys[0].alg === JWT_V2_ALG, "jwks alg");

console.log("OK — EdDSA access/refresh verify, TTLs, cross-type rejection, JWKS kid/alg");