import { z } from "zod";
import type { Database } from "./database";
import { discardPasswordCheck, hashPassword, verifyPassword } from "./passwords";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
});
export const registrationSchema = credentialsSchema.extend({ name: z.string().trim().min(1).max(100) });
export interface Identity { id: string; name: string | null; email: string; }

export async function register(db: Database, input: unknown): Promise<void> {
  const data = registrationSchema.parse(input);
  const hash = await hashPassword(data.password);
  // A single statement is atomic and returns no indication that an email already exists.
  await db.query(
    `WITH created AS (
      INSERT INTO users (name, email) VALUES ($1, $2)
      ON CONFLICT (email) DO NOTHING RETURNING id
    ) INSERT INTO password_credentials (user_id, password_hash)
      SELECT id, $3 FROM created`,
    [data.name, data.email, hash],
  );
}

export async function authenticate(db: Database, input: unknown): Promise<Identity | null> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  const result = await db.query<{id: number; name: string | null; email: string; password_hash: string}>(
    `SELECT u.id, u.name, u.email, p.password_hash
     FROM users u JOIN password_credentials p ON p.user_id = u.id WHERE u.email = $1`, [email],
  );
  const user = result.rows[0];
  if (!user) { await discardPasswordCheck(password); return null; }
  if (!await verifyPassword(password, user.password_hash)) return null;
  return { id: String(user.id), name: user.name, email: user.email };
}
