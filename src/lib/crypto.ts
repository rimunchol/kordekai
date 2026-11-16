import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { env } from "./env";

const scryptAsync = promisify(scrypt) as (
  pw: string,
  salt: Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number },
) => Promise<Buffer>;

// Keep in sync with scripts/create-admin.mjs
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | undefined;
/** Burn the same CPU as a real check so unknown usernames can't be told apart by timing. */
export async function fakeVerify(password: string) {
  dummy ??= hashPassword("kordekai-dummy-password");
  await verifyPassword(password, await dummy);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Keyed hash for session tokens and IP addresses (so a DB leak exposes neither). */
export function hmac(value: string, purpose: string): string {
  return createHmac("sha256", env.authSecret).update(`${purpose}:${value}`).digest("hex");
}
