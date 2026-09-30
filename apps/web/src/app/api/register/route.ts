import { env } from "@/lib/env";
import { database } from "@/lib/database";
import { boundedJson, sameOrigin } from "@/lib/http";
import { register, registrationSchema } from "@/lib/identity";
import { allowAttempt, clientBucket } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const config = env();
  if (!sameOrigin(request, config.APP_ORIGIN)) return Response.json({error: "Forbidden"}, {status: 403});
  let body: unknown;
  try { body = await boundedJson(request); }
  catch { return Response.json({error: "Invalid request body"}, {status: 400}); }
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) return Response.json({error: "Provide a name, valid email, and a 12–128 character password"}, {status: 400});
  try {
    const bucket = clientBucket(request.headers, config.TRUST_PROXY === "true");
    if (!await allowAttempt("register", bucket, 10, 3600)) {
      return Response.json({error: "Too many attempts. Try again later."}, {status: 429, headers: {"Retry-After": "3600"}});
    }
    await register(database(), parsed.data);
    return Response.json({message: "If this email is available, your account has been created."}, {status: 202});
  } catch {
    return Response.json({error: "Registration is temporarily unavailable"}, {status: 503});
  }
}
