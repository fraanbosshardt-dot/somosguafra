import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { budgetFor } from "@/server/planning";
import { formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtPeriod, period, todayIn } from "@/lib/dates";
import { copyBudgetAction } from "@/app/actions/modules";
import { symbolOf } from "@/lib/countries";
import { MvBackHead } from "../../head";
import { MvIcon } from "../../ui";
import { MvBudgetEditor } from "./editor";

export const metadata: Metadata = { title: "Presupuestos" };

export default async function PresupuestosMovil({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const today = todayIn(workspace.timezone);
  const p = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : period(today);
  const cur = workspace.baseCurrency;
  const db = getDb();
  const b = await budgetFor(db, workspace.id, p, cur, today);
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur);
  const limited = b.rows.filter((r) => r.limit);
  const sum = (f: (r: (typeof limited)[number]) => typeof b.totals.limit) => limited.reduce((s, r) => s.plus(f(r)), ZERO);
  const lim = sum((r) => r.limit!), spent = sum((r) => r.spent), comm = sum((r) => r.committed.plus(r.scheduled));
  const left = lim.minus(spent).minus(comm);
  const hasBudget = !!b.budget && lim.gt(0);
  const prev = [addMonths(p, -1), addMonths(p, -2), addMonths(p, -3)];
  const [txs, allCats] = await Promise.all([
    db.transaction.groupBy({ by: ["categoryId", "direction"], where: { workspaceId: workspace.id, currency: cur, type: "EXPENSE", economicPeriod: { in: prev } }, _sum: { amount: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id, kind: "EXPENSE" }, select: { id: true, parentId: true } }),
  ]);
  const parentOf = new Map(allCats.map((c) => [c.id, c.parentId ?? c.id]));
  const avg = new Map<string, number>();
  for (const t of txs) { const k = parentOf.get(t.categoryId ?? "") ?? ""; avg.set(k, (avg.get(k) ?? 0) + (Number(t._sum.amount ?? 0) * (t.direction === "OUT" ? 1 : -1)) / 3); }

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Planificar" title="Presupuestos" />
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }} aria-label="Elegir mes">
        <Link className="mv-ibtn" href={`/movil/explorar/presupuestos?mes=${addMonths(p, -1)}`} aria-label="Mes anterior"><MvIcon name="back" /></Link>
        <b style={{ fontSize: 16 }}>{fmtPeriod(p)}</b>
        <Link className="mv-ibtn" href={`/movil/explorar/presupuestos?mes=${addMonths(p, 1)}`} aria-label="Mes siguiente"><MvIcon name="chev" /></Link>
      </nav>

      {hasBudget ? (
        <>
          <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{left.isNegative() ? "Te pasaste" : "Te queda"}</div>
            <div className={`mv-num mv-amt ${left.isNegative() ? "neg" : ""}`} style={{ fontSize: 32 }}>{fm(left.abs())}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>de {fm(lim)} · gastado {fm(spent)}{comm.gt(0) ? ` · previsto ${fm(comm)}` : ""}</div>
          </section>
          <div className="mv-card-list mv-cas">
            {limited.map((r) => {
              const pct = r.spent.dividedBy(r.limit!).times(100).toNumber();
              const over = pct > 100, near = !over && pct >= 80;
              const color = over ? "var(--neg)" : near ? "#E08A1E" : "var(--brand)";
              return (
                <div key={r.id} className="mv-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b style={{ fontSize: 15 }}>{r.name}</b>
                    <span style={{ fontSize: 13, fontWeight: 800, color: r.available!.isNegative() ? "var(--neg)" : "var(--ink)" }} className="mv-amt">{fm(r.available!.abs())} {r.available!.isNegative() ? "de más" : "quedan"}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }} role="img" aria-label={`Gastaste el ${Math.round(pct)} % del límite`}><i className="mv-grow-x" style={{ display: "block", height: "100%", width: `${Math.max(2, Math.min(100, pct))}%`, background: color, borderRadius: 99 }} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--muted)" }}><span className="mv-amt">{fm(r.spent)} de {fm(r.limit!)}{r.committed.gt(0) ? ` · ${fm(r.committed)} por pagar` : ""}</span><b>{Math.round(pct)} %</b></div>
                </div>
              );
            })}
          </div>
          {b.rows.some((r) => !r.limit && r.spent.gt(0)) && (
            <details className="mv-card mv-more">
              <summary>Gastos sin límite</summary>
              <div className="mv-card-list" style={{ margin: "0 -16px" }}>
                {b.rows.filter((r) => !r.limit && r.spent.gt(0)).map((r) => <div key={r.id} className="mv-row"><span className="grow t">{r.name}</span><span className="v mv-num mv-amt">{fm(r.spent)}</span></div>)}
              </div>
            </details>
          )}
        </>
      ) : (
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <b style={{ fontSize: 16 }}>Sin presupuesto para {fmtPeriod(p).toLowerCase()}</b>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Pon un límite a las categorías que quieras controlar. Lo que gastes y lo pendiente se descuenta solo. Gastado este mes: <span className="mv-amt">{fm(b.totals.spent)}</span>.</p>
          <form action={copyBudgetAction}>
            <input type="hidden" name="from" value={addMonths(p, -1)} /><input type="hidden" name="to" value={p} />
            <button className="mv-btn" type="submit" style={{ width: "100%", borderColor: "var(--field-line)" }}>Copiar el del mes anterior</button>
          </form>
        </section>
      )}

      <details className="mv-card mv-more" open={!hasBudget}>
        <summary>{hasBudget ? "Editar límites" : "Armar el presupuesto"}</summary>
        <MvBudgetEditor key={`${p}:${b.budget?.id ?? "new"}`} period={p} symbol={symbolOf(cur)} hasBudget={hasBudget} cats={b.categories.map((c) => { const l = b.budget?.lines.find((x) => x.categoryId === c.id); return { id: c.id, name: c.name, avg: avg.get(c.id) ?? 0, limit: l ? l.limitAmount.toFixed(2) : null, projectRemaining: l?.projectRemaining ?? false }; })} />
      </details>
    </main>
  );
}
