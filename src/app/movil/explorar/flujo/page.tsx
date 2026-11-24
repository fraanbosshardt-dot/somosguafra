import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { forecast, type Certainty } from "@/server/forecast";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtPeriod, todayIn } from "@/lib/dates";
import { MvBackHead } from "../../head";
import { CountUp } from "../../ui";

export const metadata: Metadata = { title: "Flujo de caja" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Mismo cálculo que la web: saldo de hoy + lo que entra − lo que sale, mes a mes.
export default async function FlujoMovil({ searchParams }: { searchParams: Promise<{ h?: string; c?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const sp = await searchParams;
  const long = await canUse(plan, "flujo5");
  const h = [12, 24, 36, 60].includes(Number(sp.h)) && (long || Number(sp.h) === 12) ? Number(sp.h) : 12;
  const c = (sp.c === "conf" ? "conf" : "prob") as Certainty;
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const { cashNow, rows, events } = await forecast(getDb(), workspace.id, { currency: cur, today, months: h, certainty: c });
  const until = new Date(today.getTime() + 60 * 864e5);
  const daily: { date: Date; items: typeof events; delta: typeof cashNow; balance: typeof cashNow }[] = [];
  let bal = cashNow;
  for (const e of events.filter((x) => x.date <= until)) {
    const last = daily[daily.length - 1];
    bal = bal.plus(e.amount);
    if (last && last.date.getTime() === e.date.getTime()) { last.items.push(e); last.delta = last.delta.plus(e.amount); last.balance = bal; }
    else daily.push({ date: e.date, items: [e], delta: e.amount, balance: bal });
  }
  const incomeRules = await getDb().recurringRule.count({ where: { workspaceId: workspace.id, direction: "RECEIVABLE", currency: cur, pausedAt: null, OR: [{ endDate: null }, { endDate: { gte: today } }] } });
  const f = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, cur, o);
  const max = rows.reduce((m, r) => (r.end.abs().gt(m) ? r.end.abs() : m), ZERO);
  const red = rows.filter((r) => r.min.lt(0));
  const q = (o: Record<string, string>) => `/movil/explorar/flujo?${new URLSearchParams({ h: String(h), c, ...o })}`;
  const shown = rows.slice(0, 12);

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Planificar" title="Flujo de caja" />

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Terminas este mes con</div>
          <div style={{ fontSize: 32, letterSpacing: "-.02em" }} className={rows[0].end.isNegative() ? "neg" : ""}><CountUp className="mv-num mv-amt" value={rows[0].end.toNumber()} currency={cur} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          {[["Hoy", cashNow], ["En 6 meses", rows[Math.min(5, rows.length - 1)].end], [h === 12 ? "En 1 año" : `En ${h / 12} años`, rows[rows.length - 1].end]].map(([l, v]) => (
            <div key={l as string}><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{l as string}</div><b className={`mv-num mv-amt ${(v as typeof cashNow).isNegative() ? "neg" : ""}`} style={{ fontSize: 13, whiteSpace: "nowrap" }}>{f(v as typeof cashNow)}</b></div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }} className={red.length ? "neg" : "pos"}>
          {red.length ? `Ojo: en ${fmtPeriod(red[0].period).toLowerCase()} tu saldo baja a ${f(red[0].min)}${red[0].minDate ? ` (el ${fmtDate(red[0].minDate)})` : ""}.` : "Tu saldo no baja de cero en este período."}
        </p>
      </section>

      {c !== "conf" && incomeRules === 0 && (
        <div className="mv-card" style={{ background: "var(--warn-bg)", fontSize: 14, fontWeight: 600, display: "flex", flexDirection: "column", gap: 8 }}>
          <span>No tienes ingresos que se repitan: la proyección solo incluye los cobros que cargaste.</span>
          <Link className="mv-link" href="/movil/explorar/recurrentes?nueva=1" style={{ minHeight: 0 }}>Cargar tu sueldo como cobro que se repite</Link>
        </div>
      )}

      <nav className="mv-chips" aria-label="Qué incluir">
        <Link href={q({ c: "prob" })} className={c === "prob" ? "on" : ""}>Con lo que se repite</Link>
        <Link href={q({ c: "conf" })} className={c === "conf" ? "on" : ""}>Solo lo confirmado</Link>
      </nav>
      <nav className="mv-chips" aria-label="Plazo">
        {[12, 24, 36, 60].map((x) => long || x === 12
          ? <Link key={x} href={q({ h: String(x) })} className={h === x ? "on" : ""}>{x === 12 ? "1 año" : `${x / 12} años`}</Link>
          : <Link key={x} href="/movil/explorar/pro" style={{ opacity: 0.55 }}>{x / 12} años · Pro</Link>)}
      </nav>

      <section className="mv-sec" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Mes a mes{rows.length > 12 ? " (primeros 12)" : ""}</h2>
        <div className="mv-card-list mv-cas">
          {shown.map((r) => (
            <details key={r.period} className="mv-row mv-flow">
              <summary>
                <span style={{ width: 44, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>{MES[Number(r.period.slice(5, 7)) - 1]}<br /><small style={{ fontWeight: 600 }}>{r.period.slice(0, 4)}</small></span>
                <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ height: 8, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }}><i className="mv-grow-x" style={{ display: "block", height: "100%", width: `${max.isZero() ? 0 : Math.max(2, r.end.abs().dividedBy(max).times(100).toNumber())}%`, background: r.end.isNegative() ? "var(--neg)" : "var(--brand)", borderRadius: 99 }} /></span>
                  <span style={{ fontSize: 12, fontWeight: 700 }} className={r.result.isNegative() ? "neg" : "pos"}>{f(r.result, { sign: true })}</span>
                </span>
                <b className={`v mv-num mv-amt ${r.end.isNegative() ? "neg" : ""}`}>{f(r.end)}</b>
              </summary>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", fontSize: 13, fontWeight: 600, color: "var(--muted)", padding: "8px 0 0 56px" }}>
                <span>Empieza con</span><b className="mv-amt">{f(r.start)}</b>
                <span>Entra</span><b className="mv-amt pos">{f(r.realizedIn.plus(r.pendingIn))}</b>
                <span>Sale</span><b className="mv-amt">{f(r.realizedOut.plus(r.pendingOut).neg())}</b>
                <span>Punto más bajo</span><b className={`mv-amt ${r.min.isNegative() ? "neg" : ""}`}>{f(r.min)}</b>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mv-sec" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Día a día (próximos 60 días)</h2>
        {!long ? (
          <Link href="/movil/explorar/pro" className="mv-card" style={{ fontSize: 14, fontWeight: 600 }}>Con Pro ves el saldo de cada día, para saber qué día te quedas corto. <b style={{ color: "var(--brand)" }}>Ver planes</b></Link>
        ) : daily.length ? (
          <div className="mv-card-list">
            {daily.map((d) => (
              <div key={d.date.toISOString()} className="mv-row">
                <span className="grow"><span className="t" style={{ display: "block" }}>{fmtDate(d.date)}</span><span className="s">{d.items.length === 1 ? d.items[0].description : `${d.items.length} movimientos`}</span></span>
                <span style={{ textAlign: "right" }}><b className={`mv-num mv-amt ${d.balance.isNegative() ? "neg" : ""}`} style={{ display: "block", fontSize: 15 }}>{f(d.balance)}</b><span className={`mv-amt ${d.delta.isNegative() ? "" : "pos"}`} style={{ fontSize: 12, fontWeight: 700 }}>{f(d.delta, { sign: true })}</span></span>
              </div>
            ))}
          </div>
        ) : <div className="mv-card mv-empty">No hay cobros ni pagos en los próximos 60 días.</div>}
      </section>

      <details className="mv-card mv-more">
        <summary>¿Cómo se calcula?</summary>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Arranca con el dinero de tus cuentas en {cur} (sin inversiones ni tarjetas). Suma los cobros y resta los pagos pendientes, los pagos que se repiten y los resúmenes de tarjeta, en el orden de sus fechas. Cada mes empieza con el saldo final del anterior. Las cuentas en otras monedas no se mezclan.</p>
      </details>
    </main>
  );
}
