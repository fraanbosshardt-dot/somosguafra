import { canUse, requireWorkspace } from "@/lib/auth/session";
import { validPeriod } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { exportMovementsXlsx } from "@/server/io";

// Descarga de todos los movimientos en Excel (.xlsx), con fechas y montos que se pueden sumar y filtrar. Pro.
export async function GET(req: Request) {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "informes"))) return new Response("Exportar a Excel es parte de Pro.", { status: 403 });
  const db = getDb(), q = new URL(req.url).searchParams;
  const from = q.get("desde"), to = q.get("hasta"), accountId = q.get("cuenta");
  const filtered = from !== null || to !== null || accountId !== null;
  if (filtered && (!validPeriod(from) || !validPeriod(to) || from > to)) return new Response("Elegí un período válido para exportar.", { status: 400 });
  if (accountId && !await db.account.findFirst({ where: { id: accountId, workspaceId: workspace.id }, select: { id: true } })) return new Response("No encontramos la cuenta.", { status: 404 });
  const file = await exportMovementsXlsx(db, workspace.id, filtered ? { from: from!, to: to!, currency: workspace.baseCurrency, ...(accountId ? { accountId } : {}) } : undefined);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(file), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="somosguafra-movimientos-${day}.xlsx"`, "cache-control": "no-store" } });
}
