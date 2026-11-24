import "server-only";
import type { RecurringRule } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { applyWeekend, occurrences } from "@/server/recurring";

export const FREQ: Record<string, string> = { DAILY: "Todos los días", WEEKLY: "Cada semana", BIWEEKLY: "Cada 2 semanas", MONTHLY: "Todos los meses", BIMONTHLY: "Cada 2 meses", QUARTERLY: "Cada 3 meses", SEMIANNUAL: "Cada 6 meses", ANNUAL: "Una vez por año", CUSTOM: "Personalizada" };
export const MONTHLY_LIKE = ["MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"];

// La próxima fecha de cada regla desde hoy que todavía no se pagó, cobró ni canceló (igual que la web).
export async function nextDates(db: ReturnType<typeof getDb>, ws: string, rules: RecurringRule[], today: Date) {
  const done = await db.obligation.findMany({ where: { workspaceId: ws, recurringRuleId: { in: rules.map((r) => r.id) }, occurrenceDate: { gte: today }, OR: [{ status: { in: ["SETTLED", "CANCELLED"] } }, { payments: { some: {} } }] }, select: { recurringRuleId: true, occurrenceDate: true } });
  const key = new Set(done.map((o) => `${o.recurringRuleId}|${o.occurrenceDate?.toISOString().slice(0, 10)}`));
  return new Map(rules.map((r) => {
    if (r.pausedAt) return [r.id, null] as const;
    const d = occurrences(r, today, new Date(today.getTime() + 800 * 864e5)).find((x) => !key.has(`${r.id}|${x.toISOString().slice(0, 10)}`));
    return [r.id, d ? applyWeekend(d, r.weekendRule) : null] as const;
  }));
}
