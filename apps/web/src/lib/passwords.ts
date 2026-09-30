import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";

const N = 131072;
const r = 8;
const p = 1;
function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    derive(password, salt, 64, { N, r, p, maxmem: 256 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt);
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts.slice(0, 4).join(":") !== `scrypt:${N}:${r}:${p}`) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length !== 16 || expected.length !== 64) return false;
  return timingSafeEqual(await scrypt(password, salt), expected);
}

// Pay the same password-derivation cost when an account doesn't exist.
const dummySalt = Buffer.alloc(16, 0);
export async function discardPasswordCheck(password: string): Promise<void> {
  await scrypt(password, dummySalt);
}
