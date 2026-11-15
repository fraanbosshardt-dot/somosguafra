import { cronAuthorized } from "@/lib/cron-auth";
import { getDb } from "@/lib/db";
import { operationsSnapshot } from "@/server/operations";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("No autorizado", { status: 401 });
  const snapshot = await operationsSnapshot(getDb());
  return Response.json(snapshot, { status: snapshot.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
