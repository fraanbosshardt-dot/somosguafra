import Link from "next/link";
import type { Metadata } from "next";
import Decimal from "decimal.js";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { categoryReport } from "@/server/io";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtPeriod, period, todayIn } from "@/lib/dates";
import { MvBackHead } from "../../head";
import { MvProGate } from "../pro-gate";

export const metadata: Metadata = { title: "Informes" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const short = (p: string) => MES[Number(p.slice(5, 7)) - 1];

// Lo que entra y sale mes a mes, y qué categorías cambiaron entre dos meses. Mismo cálculo que la web.
export default async function InformesMovil({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "informes"))) return <MvProGate sub="Patrimonio y análisis" title="Informes" text="Tus gastos por categoría mes a mes y cómo cambia lo que entra y sale." />;
  const cur = workspace.baseCurrency;
  const sp = await searchParams;
  const full = await categoryReport(getDb(), workspace.id, cur, period(todayIn(workspace.timezone)), 6);
  const first = Math.max(0, full.totals.findIndex((t) => !t.income.isZero() || !t.expense.isZero()));
  const r = { ...full, periods: full.periods.slice(first), totals: full.totals.slice(first), rows: full.rows.map((row) => ({ ...row, values: row.values.slice(first) })) };
  const max = r.totals.reduce((m, t) => Decimal.max(m, t.income, t.expense), ZERO);
  const has = r.totals.some((t) => !t.income.isZero() || !t.expense.isZero());
  const ia = Math.max(0, r.periods.indexOf(sp.a ?? "") >= 0 ? r.periods.indexOf(sp.a!) : r.periods.length - 2);
  const ib = r.periods.indexOf(sp.b ?? "") >= 0 ? r.periods.indexOf(sp.b!) : r.periods.length - 1;
  const cmp = r.rows.map((row) => ({ name: row.name, a: row.values[ia] ?? ZERO, b: row.values[ib] ?? ZERO })).map((x) => ({ ...x, d: x.b.minus(x.a) })).filter((x) => !x.a.isZero() || !x.b.isZero()).sort((x, y) => y.d.abs().comparedTo(x.d.abs()));
  const f = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, cur, o);
  const h = (v: Decimal) => `${max.isZero() ? 0 : Math.max(3, Math.round(v.dividedBy(max).times(96).toNumber()))}px`;

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Patrimonio y análisis" title="Informes" />
      {!has ? <div className="mv-card mv-empty">Todavía no hay movimientos para mostrar. Cuando cargues ingresos y gastos, ves acá cómo cambian mes a mes.</div> : (
        <>
          <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="mv-h2" style={{ fontSize: 16 }}>Entra y sale</h2>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${r.periods.length}, minmax(0, 1fr))`, gap: 8, alignItems: "end", height: 130 }} role="img" aria-label={r.periods.map((p, i) => `${fmtPeriod(p)}: entró ${f(r.totals[i].income)}, salió ${f(r.totals[i].expense)}`).join(". ")}>
              {r.periods.map((p, i) => (
                <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 100 }}>
                    <i className="mv-bar-y" style={{ width: 10, height: h(r.totals[i].income), background: "#7FB894", borderRadius: 4 }} />
                    <i className="mv-bar-y" style={{ width: 10, height: h(r.totals[i].expense), background: "var(--brand)", borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--faint)" }}>{short(p)}</span>
                </div>
              ))}
            </div>
            <div className="mv-legend"><span><i style={{ background: "#7FB894" }} />Entró</span><span><i style={{ background: "var(--brand)" }} />Salió</span></div>
            <div className="mv-card-list" style={{ margin: "0 -16px" }}>
              {r.periods.map((p, i) => {
                const res = r.totals[i].income.minus(r.totals[i].expense);
                return <div key={p} className="mv-row"><span className="grow t">{fmtPeriod(p)}</span><b className={`v mv-num mv-amt ${res.isNegative() ? "neg" : "pos"}`}>{f(res, { sign: true })}</b></div>;
              }).reverse()}
            </div>
          </section>

          {r.periods.length > 1 && (
            <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 className="mv-h2" style={{ fontSize: 16 }}>¿Qué cambió?</h2>
              <nav className="mv-chips" aria-label="Elegir meses">
                {r.periods.slice(1).map((p) => {
                  const i = r.periods.indexOf(p);
                  return <Link key={p} href={`/movil/explorar/informes?a=${r.periods[i - 1]}&b=${p}`} className={ib === i && ia === i - 1 ? "on" : ""}>{short(r.periods[i - 1])} → {short(p)}</Link>;
                })}
              </nav>
              {cmp.length ? (
                <div className="mv-card-list" style={{ margin: "0 -16px" }}>
                  {cmp.slice(0, 12).map((x) => (
                    <div key={x.name} className="mv-row">
                      <span className="grow"><span className="t" style={{ display: "block" }}>{x.name}</span><span className="s mv-amt">{f(x.a)} → {f(x.b)}</span></span>
                      <b className={`v mv-num mv-amt ${x.d.isNegative() ? "pos" : x.d.isZero() ? "" : "neg"}`}>{f(x.d, { sign: true })}</b>
                    </div>
                  ))}
                </div>
              ) : <div className="mv-empty">Sin gastos para comparar.</div>}
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>En verde, categorías en las que gastaste menos.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
