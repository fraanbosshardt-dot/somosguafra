import { cronAuthorized } from "@/lib/cron-auth";
import { getDb } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { refreshRates } from "@/server/fx";
import { pushConfig, pushToUser } from "@/server/push";

// Tarea diaria (Vercel Cron la llama una vez por día con CRON_SECRET):
// Actualiza cotizaciones, avisos push y mantenimiento de cuentas. Sin recordatorios financieros por correo.
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("No autorizado", { status: 401 });
  const db = getDb();
  try {
    return await run(db);
  } catch (e) {
    await db.auditLog.create({ data: { action: "cron.failed", meta: { error: String(e).slice(0, 300) } } }).catch(() => {});
    throw e;
  }
}

async function run(db: ReturnType<typeof getDb>) {
  const { runBillingMaintenance } = await import("@/server/billing-maintenance");
  const { billing, delivered } = await runBillingMaintenance(db);
  const fx = await refreshRates(db).catch(() => 0);
  const sent = 0, skipped = 0; // No se envían recordatorios de finanzas personales por correo.
  const pushes = await pushDueTomorrow(db);
  // La inactividad nunca elimina cuentas ni datos financieros. La eliminación es explícita.
  const unverified = { unverifiedWarned: 0, unverifiedDeleted: 0 };
  await db.auditLog.create({ data: { action: "cron.diario", meta: { rates: fx, emails: sent, notSent: skipped, pushes, ...unverified } } });
  return Response.json({ ok: true, rates: fx, emails: sent, billing, delivered, notSent: skipped, pushes, ...unverified });
}

// Personas con avisos en el celular y algo que vence mañana en alguno de sus espacios.
async function pushDueTomorrow(db: ReturnType<typeof getDb>) {
  if (!pushConfig().enabled) return 0;
  const users = await db.user.findMany({ where: { pushSubs: { some: {} }, suspendedAt: null, deletedAt: null }, select: { id: true, memberships: { select: { workspace: { select: { id: true, timezone: true } } } } } });
  let n = 0;
  for (const u of users) {
    let due = 0;
    for (const m of u.memberships) {
      const tomorrow = new Date(todayIn(m.workspace.timezone).getTime() + 864e5);
      due += await db.obligation.count({ where: { workspaceId: m.workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: tomorrow } });
    }
    if (due) n += await pushToUser(db, u.id);
  }
  return n;
}
