import { cronAuthorized } from "@/lib/cron-auth";
import { getDb } from "@/lib/db";
import { runBillingMaintenance } from "@/server/billing-maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("No autorizado", { status: 401 });
  const result = await runBillingMaintenance(getDb());
  return Response.json(result, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
