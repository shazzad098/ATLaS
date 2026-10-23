import crypto from "node:crypto";

function masterSecret(): string {
  return process.env.MANUS_JWT_SECRET || "atlas-development-secret-do-not-use-in-production";
}

const keyCache = new Map<string, Buffer>();
function deriveKey(label: string): Buffer {
  let k = keyCache.get(label);
  if (!k) {
    k = Buffer.from(crypto.hkdfSync("sha256", masterSecret(), "atlas-kms", label, 32));
    keyCache.set(label, k);
  }
  return k;
}

export const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");
export const hmacHex = (key: string | Buffer, data: string | Buffer) => crypto.createHmac("sha256", key).update(data).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const randomId = (len = 16) => crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
export const randomDigits = (n: number) => Array.from(crypto.randomBytes(n), b => String(b % 10)).join("");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Keyed hash for tokens/OTPs stored at rest. */
export const tokenHash = (value: string) => hmacHex(deriveKey("token-hash"), value);

/** AES-256-GCM envelope for secrets at rest (gateway credentials, TOTP seeds, webhook secrets). */
export function encryptSecret(plain: string, label = "secrets"): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(label), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}
export function decryptSecret(envelope: string, label = "secrets"): string {
  const [v, iv, tag, ct] = envelope.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Invalid secret envelope");
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(label), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
export function maskSecret(s: string): string {
  if (!s) return "";
  return s.length <= 6 ? "••••" : `${s.slice(0, 3)}••••${s.slice(-3)}`;
}

/* Minimal HS256 JWT */
const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function signJwt(payload: Record<string, unknown>, ttlSeconds: number, label = "access-jwt"): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u({ alg: "HS256", typ: "JWT" });
  const body = b64u({ ...payload, iat: now, exp: now + ttlSeconds });
  const sig = crypto.createHmac("sha256", deriveKey(label)).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
export function verifyJwt<T = Record<string, unknown>>(token: string, label = "access-jwt"): (T & { exp: number; iat: number }) | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac("sha256", deriveKey(label)).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  if (!safeEqual(expected, parts[2])) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* TOTP (RFC 6238) for optional 2FA */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));
function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = h[h.length - 1] & 15;
  const code = ((h[offset] & 127) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const counter = Math.floor(Date.now() / 30000);
  for (let w = -window; w <= window; w++) if (safeEqual(hotp(secret, counter + w), code.trim())) return true;
  return false;
}
export const currentTotp = (secret: string) => hotp(secret, Math.floor(Date.now() / 30000));
