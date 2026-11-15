import { publicPlan } from "./public-plan";

type Period = { status: string; paidAt: Date | null; periodStart: Date | null; periodEnd: Date | null; refundedAmount?: { toString(): string }; amount?: { toString(): string }; financialEvents?: { kind: string; amount: { toString(): string }; occurredAt: Date }[] };
export function hasPaidCoverage(periods: Period[], at: Date) {
  return periods.some(p => (p.financialEvents?.some(e => e.kind === "gross") ? p.financialEvents.filter(e => e.kind !== "gross" && e.occurredAt <= at).reduce((n,e) => n + (e.kind === "recovery" ? -Number(e.amount) : Number(e.amount)), 0) < Number(p.amount ?? 0) : p.status === "approved") && p.paidAt && p.paidAt <= at && p.periodStart && p.periodStart <= at && p.periodEnd && p.periodEnd > at);
}
export function customerState(sub: Parameters<typeof publicPlan>[0], periods: Period[], now = new Date(), agreement?: NonNullable<Parameters<typeof publicPlan>[3]>["agreement"]) {
  const view = publicPlan(sub, true, now, { agreement });
  const paid = hasPaidCoverage(periods, now) || !!(sub?.legacyPaidUntil && sub.legacyPaidUntil > now);
  return { ...view, paid, access: paid ? "paid" as const : view.access === "paid" ? "unverified" as const : view.access };
}
