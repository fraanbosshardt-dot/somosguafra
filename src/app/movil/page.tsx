import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isEstimatedGrain } from "@/server/grain";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDayMonth, todayIn } from "@/lib/dates";
import { leftToSpend } from "./left";
import { quickConfirmAction } from "@/app/actions/app";
import { OnceButton } from "@/components/forms";
import { CountUp, DoneCard, HideAmounts, MvIcon } from "./ui";
import { SpendingDonut } from "./spending";

export const metadata: Metadata = { title: "Inicio" };
const WD = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

export default async function MovilHome({ searchParams }: { searchParams: Promise<{ listo?: string }> }) {
  const { listo } = await searchParams;
  const { workspace, user } = await requireWorkspace();
  const today = todayIn(workspace.timezone);
  const cur = workspace.baseCurrency;
  const [{ d, open, nextIn, until, owed, left, days, perDay }, spending] = await Promise.all([leftToSpend(workspace, today), spendingByCategory(workspace.id, cur, today)]);
  const first = user.name.split(" ")[0];
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, cur, o);

  const head = (
    <header className="mv-head">
      <span className="mv-avatar" aria-hidden="true">{initials}</span>
      <div className="mv-hello">Hola, {first}</div>
      <Link className="mv-ibtn" href="/movil/buscar" aria-label="Buscar"><MvIcon name="search" /></Link>
      <HideAmounts />
      <Link className="mv-ibtn" href="/movil/explorar/alertas" aria-label="Alertas"><MvIcon name="bell" /></Link>
    </header>
  );

  // Cuenta nueva sin cuentas cargadas: el primer paso, sin números vacíos.
  if (!d.accounts.length) {
    return (
      <main className="mv-main">
        {head}
        <section className="mv-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <h1 className="mv-h2" style={{ fontSize: 22 }}>Carga tu primera cuenta</h1>
          <p style={{ margin: 0, color: "var(--muted)", fontWeight: 600, lineHeight: 1.5 }}>Tu banco, una billetera virtual o el efectivo, con lo que tienes hoy. Con eso ya ves cuánto puedes gastar.</p>
          <Link className="mv-btn pri" href="/movil/explorar/cuentas/nueva" style={{ flex: "none", marginTop: 6 }}>+ Agregar una cuenta</Link>
        </section>
      </main>
    );
  }

  const cashN = Number(d.cash.toString()), owedN = Number(owed.toString());
  const leftShare = cashN > 0 ? Math.max(0, Math.min(100, ((cashN - owedN) / cashN) * 100)) : 0;
  const dueNow = open.filter((o) => o.dueDate <= today && !isEstimatedGrain(o)).sort((a, b) => (a.direction === b.direction ? 0 : a.direction === "RECEIVABLE" ? -1 : 1));
  const due = dueNow[0];
  const in7 = new Date(today.getTime() + 7 * 864e5);
  const week = open.filter((o) => o.dueDate > today && o.dueDate <= in7).slice(0, 4);

  return (
    <main className="mv-main">
      {head}

      <section aria-label="Lo que te queda" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <details className="mv-calc">
          <summary>
            <span className="mv-left-lbl">{nextIn ? `Te queda hasta tu cobro del ${fmtDayMonth(nextIn.dueDate)}` : "Te queda hasta fin de mes"} <MvIcon name="info" size={16} /></span>
            <CountUp className={`mv-left mv-num mv-amt ${left.isNegative() ? "neg" : ""}`} value={Number(left.toString())} currency={cur} />
          </summary>
          <p>Es lo que tienes en tus cuentas en {cur} ({fm(d.cash)}), menos {fm(owed)} que vence hasta el {fmtDayMonth(until)}. No suma cobros sin confirmar ni mezcla monedas.</p>
        </details>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
          {left.gt(0)
            ? <><span className="mv-chip mv-num"><span className="mv-amt">{fm(perDay)}</span>&nbsp;por día</span><span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>durante {days} {days === 1 ? "día" : "días"}</span></>
            : <span className="mv-chip warn">No alcanza para lo que vence antes</span>}
        </div>
      </section>

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>En tus cuentas</span>
          <CountUp className="mv-num mv-amt" value={cashN} currency={cur} />
        </div>
        <div className="mv-split" aria-hidden="true">
          <i className="mv-grow-x" style={{ flex: leftShare, background: "var(--brand)" }} />
          <i className="mv-grow-x" style={{ flex: 100 - leftShare, background: "var(--amber)", animationDelay: ".12s" }} />
        </div>
        <div className="mv-legend">
          <span><i style={{ background: "var(--brand)" }} />Te queda&nbsp;<b className="mv-num mv-amt">{fm(left)}</b></span>
          <span><i style={{ background: "var(--amber)" }} />A pagar&nbsp;<b className="mv-num mv-amt">{fm(owed)}</b></span>
        </div>
      </section>

      <nav className="mv-acts" aria-label="Acciones rápidas">
        <Link className="mv-act pri" href="/movil/cargar"><span><MvIcon name="plus" stroke={2.2} /></span><span>Gasto</span></Link>
        <Link className="mv-act" href="/movil/cargar?tipo=ingreso"><span><MvIcon name="up" stroke={2.2} /></span><span>Ingreso</span></Link>
        <Link className="mv-act" href="/movil/cargar?tipo=transferencia"><span><MvIcon name="swap" stroke={2.2} /></span><span>Transferir</span></Link>
        <Link className="mv-act" href="/movil/proximos"><span><MvIcon name="cal" stroke={2.2} /></span><span>Calendario</span></Link>
      </nav>

      {listo && <DoneCard text={listo === "cobro" ? "Listo, registramos el cobro." : "Listo, registramos el pago."} />}
      {!listo && due && (() => {
        const rec = due.direction === "RECEIVABLE";
        const isToday = due.dueDate.getTime() === today.getTime();
        return (
          <section className="mv-due" aria-label="Para confirmar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mv-due-tag"><span className="mv-due-dot" aria-hidden="true" />{isToday ? (rec ? "Cobras hoy" : "Vence hoy") : `Era el ${fmtDayMonth(due.dueDate)}`}</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{rec ? `¿Ya cobraste ${due.description}?` : `¿Ya pagaste ${due.description}?`}</div>
              </div>
              <b className="mv-num mv-amt" style={{ fontSize: 16, flex: "none" }}>{formatMoney(due.remaining, due.currency)}</b>
            </div>
            <div className="mv-due-btns">
              <form action={quickConfirmAction} style={{ flex: 1, display: "flex" }}>
                <input type="hidden" name="obligationId" value={due.id} />
                <input type="hidden" name="back" value="/movil" />
                <OnceButton className="mv-btn pri">{rec ? "Sí, lo cobré" : "Sí, lo pagué"}</OnceButton>
              </form>
              <Link className="mv-btn" href={`/movil/proximos/${due.id}`}>Otro monto o fecha</Link>
            </div>
            {dueNow.length > 1 && <Link className="mv-link" href="/movil/proximos" style={{ minHeight: 0, justifyContent: "center" }}>Ver {dueNow.length - 1} más para confirmar</Link>}
          </section>
        );
      })()}

      <section className="mv-sec">
        <div className="mv-sec-head"><h2 className="mv-h2">Próximos 7 días</h2><Link className="mv-link" href="/movil/proximos">Ver todo</Link></div>
        <div className="mv-card-list mv-cas">
          {week.length ? week.map((o) => (
            <Link className="mv-row" key={o.id} href={`/movil/proximos/${o.id}`}>
              <span className="mv-date"><span>{WD[o.dueDate.getUTCDay()]}</span><b>{o.dueDate.getUTCDate()}</b></span>
              <span className="grow"><span className="t" style={{ display: "block" }}>{o.description}</span><span className="s">{o.direction === "RECEIVABLE" ? "A cobrar" : o.category ?? "A pagar"}</span></span>
              <b className={`v mv-num mv-amt ${o.direction === "RECEIVABLE" ? "pos" : ""}`}>{formatMoney(o.remaining, o.currency, { sign: o.direction === "RECEIVABLE" })}</b>
            </Link>
          )) : <div className="mv-empty">No tienes nada por pagar ni cobrar esta semana.</div>}
        </div>
      </section>

      {spending.length > 0 && (
        <section className="mv-sec">
          <h2 className="mv-h2">Gastos de {new Intl.DateTimeFormat("es", { month: "long", timeZone: "UTC" }).format(today)}</h2>
          <SpendingDonut cats={spending} currency={cur} />
        </section>
      )}
    </main>
  );
}

// Las 4 categorías con más gasto este mes (igual que "En qué se fue la plata" de la web).
async function spendingByCategory(ws: string, cur: string, today: Date) {
  const db = getDb();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const rows = await db.transaction.groupBy({ by: ["categoryId"], where: { workspaceId: ws, type: "EXPENSE", currency: cur, direction: "OUT", effectiveDate: { gte: from }, reversalOfId: null, reversedBy: null }, _sum: { amount: true } });
  const ids = rows.map((r) => r.categoryId).filter(Boolean) as string[];
  const cats = ids.length ? await db.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  return rows
    .map((r) => ({ name: cats.find((c) => c.id === r.categoryId)?.name ?? "Sin categoría", total: Number(r._sum.amount ?? ZERO) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
}
