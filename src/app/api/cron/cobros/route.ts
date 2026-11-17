import { cronAuthorized } from "@/lib/cron-auth";
import { getDb } from "@/lib/db";
import { runBillingMaintenance } from "@/server/billing-maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("No autorizado", { status: 401 });
  const started=Date.now();
  const result = await runBillingMaintenance(getDb());
  // Independent support work is deliberately after the financial maintenance.
  // Its bounded failure cannot turn a successful reconciliation into an error.
  const { runSupportOverdueAlerts } = await import("@/server/support-operations");
  if(Date.now()-started<165_000) await runSupportOverdueAlerts(getDb()).catch(async () => {
    try {await getDb().auditLog.create({data:{action:"support.alert_failed",meta:{retry:"next scheduled run"}}});} catch {}
  });
  return Response.json(result, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
