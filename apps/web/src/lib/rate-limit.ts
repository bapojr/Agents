import { createHmac } from "node:crypto";
import { createClient } from "redis";
import { env } from "./env";

type RedisClient = ReturnType<typeof createClient>;
let client: RedisClient | undefined;
let connecting: Promise<unknown> | undefined;
export async function redis(): Promise<RedisClient> {
  if (!client) {
    client = createClient({ url: env().REDIS_URL, socket: { connectTimeout: 3000, reconnectStrategy: false } });
    client.on("error", () => console.error("Redis connection failed"));
  }
  if (!client.isOpen) {
    connecting ??= client.connect().finally(() => { connecting = undefined; });
    await connecting;
  }
  return client;
}

export const rateLimitScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

export function clientBucket(headers: Headers, trustProxy: boolean): string {
  // Only enable behind a proxy that replaces this header. Never trust client input by default.
  return trustProxy ? headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown" : "unknown";
}

export async function allowAttempt(scope: string, identity: string, limit: number, seconds: number): Promise<boolean> {
  const key = createHmac("sha256", env().AUTH_SECRET).update(`${scope}:${identity}`).digest("hex");
  const count = await (await redis()).eval(rateLimitScript, { keys: [`rate:${key}`], arguments: [String(seconds)] });
  return Number(count) <= limit;
}
