// Números del negocio para el panel interno. Solo cuentas y totales: nunca montos de los clientes.
import type { PrismaClient } from "@/generated/prisma/client";
import { customerState, hasPaidCoverage } from "./business-state";

const DAY = 864e5;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const ym = (d: Date) => d.toISOString().slice(0, 7);

// Cuántas unidades de una moneda vale 1 USD (la última cotización automática). USD = 1.
export async function usdRate(db: PrismaClient, currency: string): Promise<number | null> {
  if (currency === "USD") return 1;
  const r = await db.exchangeRate.findFirst({ where: { workspaceId: null, base: "USD", quote: currency }, orderBy: { fetchedAt: "desc" } });
  return r ? Number(r.sell) : null;
}
export async function toUsd(db: PrismaClient, amount: number, currency: string) {
  const r = await usdRate(db, currency);
  return r ? amount / r : null;
}
// Pasado a pesos (el panel muestra todo en pesos): moneda → dólares → pesos.
export async function toArs(db: PrismaClient, amount: number, currency: string) {
  if (currency === "ARS") return amount;
  const [r, ars] = await Promise.all([usdRate(db, currency), usdRate(db, "ARS")]);
  return r && ars ? (amount / r) * ars : null;
}

// Cotizaciones por informe, no por fila. Nunca se comparte información entre peticiones.
export async function arsConverter(db: PrismaClient, currencies: Iterable<string>) {
  const keys = [...new Set(currencies)].filter(c => c !== "ARS");
  const rates = new Map<string, number | null>();
  if (keys.length) await Promise.all([...new Set([...keys, "ARS"])].map(async c => rates.set(c, await usdRate(db, c))));
  return (amount: number, currency: string): number | null => {
    if (currency === "ARS") return amount;
    const rate = rates.get(currency), ars = rates.get("ARS");
    return rate && ars ? amount / rate * ars : null;
  };
}

// Estadísticas de cuenta y de suscripción mantienen unidades explícitas.
const businessUser = { deletedAt: null, memberships: { some: { role: "OWNER" as const, workspace: { excludeFromMetrics: false } } } };
export async function overview(db: PrismaClient, _prices: { monthly: number; yearly: number }, now = new Date()) {
  const from = new Date(now.getTime() - 30 * DAY);
  const [users, newWeek, newMonth, dau, mau, spaces, ticketPending, contactPending] = await Promise.all([
    db.user.count({ where: businessUser }),
    db.user.count({ where: { ...businessUser, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
    db.user.count({ where: { ...businessUser, createdAt: { gte: from } } }),
    db.user.count({ where: { ...businessUser, lastSeenAt: { gte: new Date(now.getTime() - DAY) } } }),
    db.user.count({ where: { ...businessUser, lastSeenAt: { gte: from } } }),
    db.workspace.findMany({ where: { excludeFromMetrics: false }, select: { archivedAt: true, subscription: true, invoices: { where: { periodEnd: { gt: from }, paidAt: { lte: now } }, select: { status: true, amount: true, paidAt: true, periodStart: true, periodEnd: true, financialEvents: { select: { kind: true, amount: true, occurredAt: true } } } }, billingAgreements: { where: { status: { in: ["authorized", "paused", "pending", "creating", "uncertain"] } }, orderBy: { createdAt: "desc" }, select: { providerRef: true, status: true, amount: true, cycle: true, startsAt: true } } } }),
    db.supportTicket.count({ where: { status: {in:["OPEN","IN_PROGRESS","WAITING_INTERNAL"]} } }),
    db.contactMessage.count({ where: { status: {in:["OPEN","IN_PROGRESS","WAITING_INTERNAL"]} } }),
  ]);
  const openTickets=ticketPending+contactPending;
  let mrrUnknown = 0;
  let paid = 0, gifted = 0, trials = 0, mrr = 0, startingPaid = 0, lostPaid = 0, renewalOff = 0, pending = 0, unverifiable = 0;
  for (const w of spaces) {
    const sub = w.subscription;
    // Una solicitud nueva nunca reemplaza el contrato vigente al medir ingreso recurrente.
    const agreement = w.billingAgreements.find(a => a.providerRef && a.providerRef === sub?.providerRef) ?? w.billingAgreements[0];
    const state = customerState(sub, w.invoices, now, agreement);
    if (w.archivedAt) {
      if (hasPaidCoverage(w.invoices, from)) { startingPaid++; lostPaid++; }
      continue; // conservar historia de ingresos/cohorte, nunca contabilizar acceso de una cuenta eliminada
    }
    if (state.paid) { paid++; if (state.billing === "active" || state.billing === "scheduled") {
      const amount = Number(agreement?.amount ?? 0);
      if (amount > 0 && agreement?.providerRef === sub?.providerRef) mrr += amount / (agreement.cycle === "yearly" ? 12 : 1);
      else mrrUnknown++;
    } }
    else if (state.access === "trial") trials++;
    else if (state.access === "granted") gifted++;
    else if (state.access === "unverified") unverifiable++;
    if (state.paid && state.billing === "canceled") renewalOff++;
    if (w.billingAgreements.some(a => ["pending", "creating", "uncertain"].includes(a.status))) pending++;
    if (hasPaidCoverage(w.invoices, from)) { startingPaid++; if (!state.paid) lostPaid++; }
  }
  const churn = startingPaid ? lostPaid / startingPaid * 100 : null;
  return { users, newWeek, newMonth, dau, mau, paid, gifted, trials, mrr, mrrUnknown, conversion: spaces.some(w => !w.archivedAt) ? paid / spaces.filter(w => !w.archivedAt).length * 100 : 0, churn, startingPaid, lostPaid, renewalOff, pending, unverifiable, openTickets };
}

export async function signupsByDay(db: PrismaClient, days = 30, now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * DAY);
  const rows = await db.user.findMany({ where: { ...businessUser, createdAt: { gte: from } }, select: { createdAt: true } });
  const out = Array.from({ length: days }, (_, i) => ({ key: ymd(new Date(from.getTime() + i * DAY)), n: 0 }));
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const r of rows) { const i = idx.get(ymd(r.createdAt)); if (i !== undefined) out[i].n++; }
  return out;
}

// Cobrado por mes (pagos aprobados), en pesos.
export async function revenueByMonth(db: PrismaClient, months = 6, now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const inv = await db.paymentEvent.findMany({ where: { occurredAt: { gte: from }, invoice: { workspace: { excludeFromMetrics: false } } } });
  const keys = Array.from({ length: months }, (_, i) => ym(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1))));
  const out = keys.map((key) => ({ key, n: 0, count: 0 }));
  const convert = await arsConverter(db, inv.map(i => i.currency));
  for (const i of inv) {
    const row = out.find((o) => o.key === ym(i.occurredAt));
    if (!row) continue;
    row.count++;
    const v = convert(Number(i.amount) * (["gross", "recovery"].includes(i.kind) ? 1 : -1), i.currency);
    if (v !== null) row.n += v;
  }
  return out.map((o) => ({ ...o, n: Math.round(o.n * 100) / 100 }));
}

export async function funnel(db: PrismaClient) {
  const users = await db.user.findMany({ where: businessUser, select: { id: true, emailVerified: true, createdAt: true, memberships: { where: { role: "OWNER", workspace: { excludeFromMetrics: false } }, select: { workspace: { select: { onboardedAt: true, transactions: { take: 1, select: { id: true } } } } } } } });
  return [
    { label: "Cuentas titulares", n: users.length },
    { label: "Correo confirmado", n: users.filter(u => u.emailVerified).length },
    { label: "Bienvenida terminada", n: users.filter(u => u.memberships.some(m => m.workspace.onboardedAt)).length },
    { label: "Primera acción registrada", n: users.filter(u => u.memberships.some(m => m.workspace.transactions.length)).length },
  ];
}

export async function retention(db: PrismaClient, now = new Date()) {
  const setting = await db.appSetting.findUnique({ where: { key: "analyticsStartedAt" } });
  const since = typeof setting?.value === "string" ? new Date(setting.value) : now;
  const users = await db.user.findMany({ where: { ...businessUser, createdAt: { gte: since } }, select: { id: true, createdAt: true } });
  const activity = await db.productActivity.findMany({ where: { userId: { in: users.map(u => u.id) } }, select: { userId: true, day: true } });
  const activeDays = new Set(activity.map(a => `${a.userId}|${Math.floor(a.day.getTime() / DAY)}`));
  const localDay = (date: Date) => Math.floor(Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) + "T00:00:00Z") / DAY);
  return [7, 30].map(days => {
    const eligible = users.filter(u => localDay(now) > localDay(u.createdAt) + days);
    const returned = eligible.filter(u => activeDays.has(`${u.id}|${localDay(u.createdAt) + days}`)).length;
    return { days, eligible: eligible.length, returned, rate: eligible.length ? returned / eligible.length * 100 : null };
  });
}

export async function byCountry(db: PrismaClient, top = 6) {
  const g = await db.workspace.groupBy({ by: ["country"], where: { excludeFromMetrics: false, archivedAt: null }, _count: { _all: true } });
  const sorted = g.map((x) => ({ key: x.country, n: x._count._all })).sort((a, b) => b.n - a.n);
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((t, x) => t + x.n, 0);
  return rest ? [...head, { key: "OTROS", n: rest }] : head;
}

export async function signupMethods(db: PrismaClient, days = 30, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY);
  const [google, email] = await Promise.all([
    db.auditLog.count({ where: { action: "auth.signup", createdAt: { gte: since }, meta: { path: ["via"], equals: "google" } } }),
    db.auditLog.count({ where: { action: "auth.signup", createdAt: { gte: since }, NOT: { meta: { path: ["via"], equals: "google" } } } }),
  ]);
  return { google, email };
}

// Costos de la empresa por mes, en pesos.
export async function monthlyCosts(db: PrismaClient) {
  const costs = await db.companyCost.findMany({ where: { active: true } });
  let total = 0, unknown = 0;
  const convert = await arsConverter(db, costs.map(c => c.currency));
  for (const c of costs) {
    const perMonth = Number(c.amount) / (c.period === "yearly" ? 12 : 1);
    const v = convert(perMonth, c.currency);
    if (v === null) unknown++; else total += v;
  }
  return { total: Math.round(total * 100) / 100, unknown, items: costs };
}
