import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { isoDate, todayIn } from "@/lib/dates";
import { CountUp, MvIcon, Toast } from "../ui";

export const metadata: Metadata = { title: "Movimientos" };
const WD = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WD1 = ["D", "L", "M", "M", "J", "V", "S"];
const TIPOS = [["todos", "Todos"], ["gastos", "Gastos"], ["ingresos", "Ingresos"], ["transferencias", "Transf."]] as const;

export default async function Movimientos({ searchParams }: { searchParams: Promise<{ dia?: string; tipo?: string; q?: string; guardado?: string; borrado?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const cur = workspace.baseCurrency;
  const tipo = TIPOS.some(([k]) => k === sp.tipo) ? sp.tipo! : "todos";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const week = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() - (6 - i) * 864e5));
  const day = sp.dia && week.some((d) => isoDate(d) === sp.dia) ? new Date(`${sp.dia}T00:00:00Z`) : null;

  // Gráfico: lo gastado cada día de los últimos 7 días (en la moneda principal).
  const spent = await db.transaction.groupBy({
    by: ["effectiveDate"],
    where: { workspaceId: workspace.id, type: "EXPENSE", direction: "OUT", currency: cur, effectiveDate: { gte: week[0], lte: today }, reversalOfId: null, reversedBy: null },
    _sum: { amount: true },
  });
  const perDay = week.map((d) => Number(spent.find((s) => s.effectiveDate.getTime() === d.getTime())?._sum.amount ?? 0));
  const max = Math.max(1, ...perDay);
  const weekTotal = perDay.reduce((a, b) => a + b, 0);
  const dayTotal = day ? perDay[week.findIndex((d) => d.getTime() === day.getTime())] : 0;

  // Lista: el día elegido, o lo del mes. Una transferencia se muestra una vez (la pata que sale).
  const byType: Prisma.TransactionWhereInput = tipo === "gastos" ? { type: "EXPENSE" } : tipo === "ingresos" ? { type: "INCOME" } : tipo === "transferencias" ? { type: "TRANSFER", direction: "OUT" } : { NOT: { type: "TRANSFER", direction: "IN" } };
  const text = (v: string) => ({ contains: v, mode: "insensitive" as const });
  const list = await db.transaction.findMany({
    where: {
      workspaceId: workspace.id, reversalOfId: null, ...byType,
      effectiveDate: day ? day : { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), lte: today },
      ...(q ? { OR: [{ description: text(q) }, { category: { name: text(q) } }, { account: { name: text(q) } }] } : {}),
    },
    include: { account: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    take: 150,
  });
  const groups = new Map<string, typeof list>();
  for (const t of list) { const k = isoDate(t.effectiveDate); groups.set(k, [...(groups.get(k) ?? []), t]); }
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base = { dia: sp.dia ?? null, tipo: tipo === "todos" ? null : tipo, q: q || null, ...patch };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return `/movil/movimientos${s ? `?${s}` : ""}`;
  };
  const title = (d: Date) => (d.getTime() === today.getTime() ? `Hoy, ${WD[d.getUTCDay()]} ${d.getUTCDate()}` : `${WD[d.getUTCDay()][0].toUpperCase()}${WD[d.getUTCDay()].slice(1)} ${d.getUTCDate()}`);

  return (
    <main className="mv-main">
      {sp.guardado && <Toast text="Listo, guardamos los cambios." />}
      {sp.borrado && <Toast text="Listo, eliminamos el movimiento." />}
      <header className="mv-head"><h1 className="mv-hello" style={{ fontSize: 24, letterSpacing: "-.02em" }}>Movimientos</h1></header>

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{day ? `Gastaste el ${WD[day.getUTCDay()]} ${day.getUTCDate()}` : "Gastaste en los últimos 7 días"}</div>
            <div style={{ fontSize: 30, letterSpacing: "-.02em", marginTop: 2 }}><CountUp className="mv-num mv-amt" value={day ? dayTotal : weekTotal} currency={cur} /></div>
          </div>
          {day && <Link className="mv-btn" href={qs({ dia: null })} style={{ flex: "none", height: 36, fontSize: 13, borderColor: "var(--field-line)" }}>Ver semana</Link>}
        </div>
        <div className="mv-bars">
          {week.map((d, i) => {
            const on = day?.getTime() === d.getTime();
            return (
              <Link key={i} href={qs({ dia: on ? null : isoDate(d) })} aria-label={`${WD[d.getUTCDay()]} ${d.getUTCDate()}: ${formatMoney(String(perDay[i]), cur)}`} aria-current={on ? "true" : undefined}>
                <i style={{ height: `${Math.max(8, Math.round((perDay[i] / max) * 88))}px`, background: on ? "var(--brand)" : day ? "#DDE3DF" : "#A9C9B6" }} />
                <span style={{ color: on ? "var(--brand)" : "var(--faint)" }}>{WD1[d.getUTCDay()]}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <form className="mv-search" action="/movil/movimientos">
        <MvIcon name="search" />
        {day && <input type="hidden" name="dia" value={sp.dia} />}
        {tipo !== "todos" && <input type="hidden" name="tipo" value={tipo} />}
        <input type="search" name="q" defaultValue={q} placeholder="Buscar un movimiento" aria-label="Buscar un movimiento" />
      </form>

      <nav className="mv-chips" aria-label="Filtrar por tipo">
        {TIPOS.map(([k, label]) => <Link key={k} href={qs({ tipo: k === "todos" ? null : k })} className={tipo === k ? "on" : ""} aria-current={tipo === k ? "true" : undefined}>{label}</Link>)}
      </nav>

      {groups.size === 0 && <div className="mv-card mv-empty">{q ? `No encontramos movimientos con «${q}».` : "No hay movimientos con ese filtro."}</div>}
      {[...groups.entries()].map(([k, items]) => {
        const d = new Date(`${k}T00:00:00Z`);
        const out = items.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0);
        return (
          <section key={k} className="mv-sec" style={{ gap: 8 }}>
            <div className="mv-sec-head" style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)" }}><span>{title(d)}</span>{out > 0 && <span className="mv-num mv-amt">− {formatMoney(String(out), cur)}</span>}</div>
            <div className="mv-card-list mv-cas">
              {items.map((t) => {
                const tr = t.type === "TRANSFER", inc = t.type === "INCOME";
                return (
                  <Link key={t.id} className="mv-row" href={`/movil/movimientos/${t.id}`}>
                    <span className="mv-date" style={{ background: inc ? "#EEF6F1" : tr ? "#EEF1F4" : "var(--soft)", color: inc ? "var(--pos)" : "var(--brand)" }}><MvIcon name={inc ? "up" : tr ? "swap" : "list"} /></span>
                    <span className="grow"><span className="t" style={{ display: "block" }}>{t.description}</span><span className="s">{[t.category?.name, t.account.name].filter(Boolean).join(" · ")}</span></span>
                    <b className={`v mv-num mv-amt ${inc ? "pos" : ""}`} style={tr ? { color: "var(--muted)" } : undefined}>{inc ? "+ " : ""}{formatMoney(t.amount, t.currency)}</b>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
