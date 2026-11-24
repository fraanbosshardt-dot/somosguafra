import "server-only";
import type { getDb } from "@/lib/db";
import { materialize } from "@/server/recurring";
import { closeStatements } from "@/server/cards";
import { coverOlderSales } from "@/server/grain";
import { MATERIALIZE_DAYS } from "@/server/forecast";

type Db = ReturnType<typeof getDb>;

// Pendientes de reglas recurrentes y resúmenes de tarjeta ya cerrados: se generan solos y sin duplicar.
// Se recalculan al cambiar el día o cada 15 minutos, no en cada página. Lo usan la web (/app) y la app (/movil).
export async function keepHouse(db: Db, workspace: { id: string; housekeptAt: Date | null }, cerealOn: boolean, today: Date) {
  const kept = workspace.housekeptAt;
  if (kept && kept >= today && Date.now() - kept.getTime() <= 15 * 60_000) return;
  await materialize(db, workspace.id, new Date(today.getTime() + MATERIALIZE_DAYS * 864e5));
  await closeStatements(db, workspace.id, today);
  // Ventas de cereal cargadas antes de la venta mensual: su mes no se cuenta dos veces (no hace nada si ya está).
  if (cerealOn) await coverOlderSales(db, workspace.id, today);
  await db.workspace.update({ where: { id: workspace.id }, data: { housekeptAt: new Date() } });
}
