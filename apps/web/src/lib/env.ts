import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().refine((v) => /^postgres(ql)?:/.test(v)),
  REDIS_URL: z.string().url().refine((v) => /^rediss?:/.test(v)),
  AUTH_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().url(),
  AUTH_URL: z.string().url(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
}).superRefine((v, ctx) => {
  if (new URL(v.AUTH_URL).origin !== new URL(v.APP_ORIGIN).origin) {
    ctx.addIssue({code: "custom", message: "AUTH_URL and APP_ORIGIN must use the same origin"});
  }
  if (Boolean(v.AUTH_GOOGLE_ID) !== Boolean(v.AUTH_GOOGLE_SECRET)) {
    ctx.addIssue({code: "custom", message: "Both Google OAuth credentials are required"});
  }
  if (process.env.NODE_ENV === "production" && !v.APP_ORIGIN.startsWith("https://")) {
    ctx.addIssue({code: "custom", message: "Production APP_ORIGIN requires HTTPS"});
  }
});

export type Environment = z.infer<typeof schema>;
let cached: Environment | undefined;
export function env(): Environment {
  // Lazy validation allows builds without embedding runtime credentials.
  cached ??= schema.parse(process.env);
  return cached;
}
