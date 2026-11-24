import "server-only";
import { getDb } from "@/lib/db";
import { dashboard, openObligations } from "@/server/ledger";
import { spendableUntil } from "@/server/spendable";
import { isEstimatedGrain } from "@/server/grain";
import { period, periodEnd } from "@/lib/dates";

// "Te queda": lo que tienes en cuentas menos lo que vence antes de tu próximo cobro (la misma regla que la web).
export async function leftToSpend(ws: { id: string; baseCurrency: string }, today: Date) {
  const db = getDb();
  const cur = ws.baseCurrency;
  const openRequest = openObligations(db, ws.id, today);
  const [d, open] = await Promise.all([dashboard(db, ws.id, cur, today, openRequest), openRequest]);
  const base = open.filter((o) => o.currency === cur);
  const sure = base.filter((o) => !isEstimatedGrain(o));
  const nextIn = sure.find((o) => o.direction === "RECEIVABLE" && o.dueDate > today);
  const until = nextIn?.dueDate ?? periodEnd(period(today));
  return { d, open, nextIn, until, ...spendableUntil(d.cash, base, cur, today, until, !nextIn) };
}
