import { operationsAuthorized } from "@/lib/cron-auth";
import { getDb } from "@/lib/db";
import { operationsSnapshot } from "@/server/operations";
import { billingProviderProbe } from "@/server/billing-provider-probe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  if (!operationsAuthorized(req)) return new Response("No autorizado", { status: 401, headers: { "cache-control": "no-store" } });
  if (new URL(req.url).searchParams.get("diagnostic") === "provider") {
    return Response.json(await billingProviderProbe(getDb()), { headers: { "cache-control": "no-store" } });
  }
  const snapshot = await operationsSnapshot(getDb());
  return Response.json(snapshot, { status: snapshot.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
