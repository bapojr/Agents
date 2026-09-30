import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import type { Database } from "../src/lib/database";

const state = vi.hoisted(() => ({db: undefined as Database | undefined, allow: vi.fn()}));
vi.mock("../src/lib/database", () => ({database: () => state.db}));
vi.mock("../src/lib/rate-limit", () => ({allowAttempt: state.allow, clientBucket: () => "test-client"}));

import { POST as register } from "../src/app/api/register/route";
import { handlers } from "../src/auth";

const pg = new PGlite({extensions:{vector}});
const origin = "http://localhost:3000";
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://local:local@localhost/agents");
  vi.stubEnv("REDIS_URL", "redis://localhost:6379/0");
  vi.stubEnv("AUTH_SECRET", "test-only-secret-".repeat(4));
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("AUTH_URL", origin);
  vi.stubEnv("NODE_ENV", "test");
  await pg.exec(await readFile(new URL("../../../db/migrations/0001_core.sql", import.meta.url), "utf8"));
  state.db = {async query(sql, values) {
    const result = await pg.query(sql, values);
    return {rows: result.rows, rowCount: result.affectedRows ?? result.rows.length};
  }} as Database;
});
beforeEach(() => { state.allow.mockReset(); state.allow.mockResolvedValue(true); });
afterAll(async () => { await pg.close(); vi.unstubAllEnvs(); });

function registration(email = "flow@example.com"): Request {
  return new Request(`${origin}/api/register`, {
    method:"POST", headers:{origin,"content-type":"application/json"},
    body:JSON.stringify({name:"Flow test",email,password:"a valid test passphrase"}),
  });
}
function cookieHeader(response: Response): string {
  return response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

describe("Auth.js HTTP credential flow", () => {
  it("registers, signs in with CSRF protection, and reads an authenticated session", async () => {
    expect((await register(registration())).status).toBe(202);
    const csrf = await handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
    const {csrfToken} = await csrf.json();
    expect(csrfToken).toBeTypeOf("string");
    const login = await handlers.POST(new NextRequest(`${origin}/api/auth/callback/credentials`, {
      method:"POST", headers:{"content-type":"application/x-www-form-urlencoded",cookie:cookieHeader(csrf)},
      body:new URLSearchParams({csrfToken,email:"flow@example.com",password:"a valid test passphrase",callbackUrl:origin}),
    }));
    expect(login.status).toBe(302);
    const cookie = cookieHeader(login);
    expect(cookie).toContain("authjs.session-token=");
    const session = await handlers.GET(new NextRequest(`${origin}/api/auth/session`, {headers:{cookie}}));
    const payload = await session.json();
    expect(payload.user.email).toBe("flow@example.com");
    expect(payload.user.id).toBeTypeOf("string");
    expect(payload.user).not.toHaveProperty("password_hash");
  });
  it("does not create a session without a valid CSRF token", async () => {
    const response = await handlers.POST(new NextRequest(`${origin}/api/auth/callback/credentials`, {
      method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({email:"flow@example.com",password:"a valid test passphrase"}),
    }));
    expect(cookieHeader(response)).not.toContain("authjs.session-token=");
  });
  it("does not issue a session when the login rate limit is exceeded", async () => {
    state.allow.mockResolvedValue(false);
    const csrf = await handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
    const {csrfToken} = await csrf.json();
    const response = await handlers.POST(new NextRequest(`${origin}/api/auth/callback/credentials`, {
      method:"POST", headers:{"content-type":"application/x-www-form-urlencoded",cookie:cookieHeader(csrf)},
      body:new URLSearchParams({csrfToken,email:"flow@example.com",password:"a valid test passphrase"}),
    }));
    expect(cookieHeader(response)).not.toContain("authjs.session-token=");
  });
  it("fails closed when the rate limiter is unavailable", async () => {
    state.allow.mockRejectedValueOnce(new Error("redis unavailable"));
    expect((await register(registration("closed@example.com"))).status).toBe(503);
    expect((await pg.query("SELECT id FROM users WHERE email='closed@example.com'")).rows).toHaveLength(0);
  });
  it("returns 429 when registration is throttled", async () => {
    state.allow.mockResolvedValueOnce(false);
    expect((await register(registration("blocked@example.com"))).status).toBe(429);
    expect((await pg.query("SELECT id FROM users WHERE email='blocked@example.com'")).rows).toHaveLength(0);
  });
  it("rejects registration from another origin", async () => {
    const request = registration("foreign@example.com");
    request.headers.set("origin", "https://attacker.example");
    expect((await register(request)).status).toBe(403);
  });
});
