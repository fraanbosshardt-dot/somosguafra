import type { Db } from "./ledger";
import { amountFor } from "./recurring";
import { dec, ZERO, type MoneyValue } from "@/lib/money";
// Equivalente orientativo, no calendario de cobros ni compromiso contable.
const TIMES: Record<string, string> = { DAILY: "365", CUSTOM: "12", WEEKLY: "52", BIWEEKLY: "26", MONTHLY: "12", BIMONTHLY: "6", QUARTERLY: "4", SEMIANNUAL: "2", ANNUAL: "1" };
export const annualEquivalent = (amount: MoneyValue, frequency: string, interval = 1) => dec(amount).times(TIMES[frequency] ?? "0").dividedBy(Math.max(1,interval));
export async function recurringCosts(db: Db, ws: string, today: Date) {
  const [rules, subscriptions] = await Promise.all([
    db.recurringRule.findMany({ where: { workspaceId: ws, direction: "PAYABLE", pausedAt: null, startDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] }, select: { id: true, description: true, currency: true, amount: true, frequency: true, interval:true,startDate:true,increasePct:true,increaseEveryMonths:true,variableAmount: true } }),
    db.cardSubscription.findMany({ where: { card: { workspaceId: ws, active: true }, startDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] }, include: { card: { select: { id: true, name: true, currency: true } } } }),
  ]);
  const rows = [
    ...rules.map(r => ({ id:r.id,name:r.description,amount:amountFor(r,today).toFixed(2),currency:r.currency,frequency:r.frequency,interval:r.interval,variable:r.variableAmount,annual:annualEquivalent(amountFor(r,today),r.frequency,r.interval),href:"/app/recurrentes",source:"Cuenta" })),
    ...subscriptions.map(s => ({ id:s.id,name:s.description,amount:s.amount.toFixed(2),currency:s.card.currency,frequency:"MONTHLY",interval:1,variable:false,annual:annualEquivalent(s.amount,"MONTHLY"),href:`/app/tarjetas/${s.card.id}`,source:s.card.name })),
  ].sort((a,b) => a.currency.localeCompare(b.currency) || b.annual.cmp(a.annual));
  const totals = new Map<string, typeof ZERO>();
  for (const r of rows) totals.set(r.currency,(totals.get(r.currency) ?? ZERO).plus(r.annual));
  return { rows, totals:[...totals].map(([currency,annual]) => ({currency,annual})) };
}
