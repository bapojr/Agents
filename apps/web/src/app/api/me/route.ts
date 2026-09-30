import { auth } from "@/auth";
import { database } from "@/lib/database";

export const runtime = "nodejs";
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({error: "Unauthorized"}, {status: 401});
  const result = await database().query(
    "SELECT id, name, email, plan FROM users WHERE id = $1", [session.user.id],
  );
  if (!result.rows[0]) return Response.json({error: "Unauthorized"}, {status: 401});
  return Response.json({user: result.rows[0]}, {headers: {"Cache-Control": "no-store"}});
}
