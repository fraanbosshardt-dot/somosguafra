import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { canAfford, forecast } from "@/server/forecast";
import { formatMoney, parseAmount, ZERO } from "@/lib/money";
import { addMonths, fmtDate, fmtPeriod, isoDate, parseDate, period, periodStart, todayIn } from "@/lib/dates";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteScenarioAction, saveScenarioAction } from "@/app/actions/modules";
import { MvBackHead } from "../../head";
import { MvProGate } from "../pro-gate";

export const metadata: Metadata = { title: "Simulador" };
type SP = Record<string, string | undefined>;
const MAX_SCENARIOS = 10;
const URL0 = "/movil/explorar/simulador";

// Probar una decisión antes de tomarla. Nada de esto cambia los datos (mismo cálculo que la web).
export default async function SimuladorMovil({ searchParams }: { searchParams: Promise<SP> }) {
  const { workspace, plan } = await requireWorkspace();
  const sp = await searchParams;
  const tab = sp.tab === "escenarios" ? "escenarios" : "cuotas";
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, cur, o);
  const tabs = (
    <nav className="mv-chips" aria-label="Qué simular">
      <Link href={URL0} className={tab === "cuotas" ? "on" : ""}>¿Lo compro en cuotas?</Link>
      <Link href={`${URL0}?tab=escenarios`} className={tab === "escenarios" ? "on" : ""}>Escenarios · Pro</Link>
    </nav>
  );

  if (tab === "cuotas") {
    const price = parseAmount(sp.precio ?? "");
    const n = Math.max(1, Math.min(48, Number.parseInt(sp.cuotas ?? "6", 10) || 6));
    const financed = sp.interes === "con" ? parseAmount(sp.total ?? "") : null;
    const first = parseDate(sp.primera ?? "") ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 10));
    const cushion = parseAmount(sp.colchon ?? "") ?? ZERO;
    const loan = sp.tipo === "prestamo";
    const r = price && price.gt(0) ? await canAfford(getDb(), workspace.id, { currency: cur, today, price, installments: n, financedTotal: loan ? financed ?? price : financed, firstDue: first, cushion, inflow: loan ? price : null }) : null;
    return (
      <main className="mv-main">
        <MvBackHead href="/movil/explorar" sub="Planificar" title="Simulador" />
        {tabs}
        <form className="mv-card mv-web" method="get" action={`${URL0}#resultado`}>
          <label className="field">Es…<select name="tipo" defaultValue={loan ? "prestamo" : "compra"}><option value="compra">Una compra en cuotas</option><option value="prestamo">Un préstamo (te prestan dinero)</option></select></label>
          <label className="field">{loan ? "¿Cuánto te prestan?" : "Precio de contado"}<input name="precio" inputMode="decimal" placeholder="0,00" defaultValue={sp.precio ?? ""} /></label>
          <label className="field">Cuotas<select name="cuotas" defaultValue={String(n)}>{[1, 2, 3, 6, 9, 12, 18, 24, 36].map((x) => <option key={x} value={x}>{x === 1 ? "En un pago" : `${x} cuotas`}</option>)}</select></label>
          <label className="field">Primera cuota<input name="primera" type="date" defaultValue={isoDate(first)} /></label>
          <label className="field">Interés<select name="interes" defaultValue={sp.interes ?? "sin"}><option value="sin">Sin interés</option><option value="con">Con interés</option></select></label>
          <label className="field">{loan ? "Total a devolver" : "Total financiado (si es con interés)"}<input name="total" inputMode="decimal" placeholder="0,00" defaultValue={sp.total ?? ""} /></label>
          <label className="field">Colchón mínimo que quieres mantener<input name="colchon" inputMode="decimal" placeholder="0,00" defaultValue={sp.colchon ?? ""} /></label>
          <div><button className="btn pri" type="submit" style={{ width: "100%" }}>Calcular</button></div>
        </form>
        <div id="resultado" style={{ display: "flex", flexDirection: "column", gap: 12, scrollMarginTop: 16 }}>
          {!r ? <div className="mv-card mv-empty">Pon el precio y las cuotas para ver si te alcanza.</div> : (
            <>
              <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 6, background: r.ok ? "var(--mint)" : "#FDECEA" }}>
                <b style={{ fontSize: 22, color: r.ok ? "#0F3A2D" : "#7A1A16" }}>{r.ok ? (loan ? "Sí, lo puedes pagar" : "Sí, puedes") : "No te conviene"}</b>
                {loan && price && <span style={{ fontSize: 14, fontWeight: 600 }}>Te prestan {fm(price)} y devuelves {fm(r.total)}: te cuesta {fm(r.total.minus(price))}.</span>}
                <span style={{ fontSize: 14, fontWeight: 600 }}>{r.installments > 1 ? `${r.installments} cuotas de ${fm(r.cuota)}` : `Un pago de ${fm(r.total)}`}. {r.ok
                  ? `Tu saldo más bajo sería ${fm(r.worst.min)}${r.worst.minDate ? ` (${fmtDate(r.worst.minDate)})` : ""}.`
                  : `En ${fmtPeriod(r.worst.period).toLowerCase()} tu saldo bajaría a ${fm(r.worst.min)}${r.cushion.gt(0) ? `, por debajo de tu colchón` : ""}.`}</span>
              </section>
              <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <b style={{ fontSize: 15 }}>Otras opciones (mismo total)</b>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{r.options.map((o) => <span key={o.installments} style={{ fontSize: 13, fontWeight: 800, padding: "8px 12px", borderRadius: 999, background: o.ok ? "var(--mint)" : "#FDECEA", color: o.ok ? "#0F3A2D" : "#7A1A16" }}>{o.installments === 1 ? "Contado" : `${o.installments} cuotas`} · {fm(o.cuota)} {o.ok ? "✓" : "✕"}</span>)}</div>
              </section>
              <section className="mv-sec" style={{ gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Cómo quedaría tu dinero</h2>
                <div className="mv-card-list">{r.rows.map((x, i) => (
                  <div key={x.period} className="mv-row">
                    <span className="grow"><span className="t" style={{ display: "block" }}>{fmtPeriod(x.period)}</span><span className="s mv-amt">Sin la compra {fm(r.baseRows[i].end)}{x.cuota.gt(0) ? ` · cuota ${fm(x.cuota)}` : ""}</span></span>
                    <b className={`v mv-num mv-amt ${x.end.isNegative() ? "neg" : ""}`}>{fm(x.end)}</b>
                  </div>
                ))}</div>
              </section>
            </>
          )}
        </div>
      </main>
    );
  }

  if (!(await canUse(plan, "simulador"))) return <MvProGate sub="Planificar" title="Escenarios" text="Compara tu situación con escenarios: gastar más, perder un ingreso, recibir un extra o invertir todos los meses." />;

  const db = getDb();
  const [incomeRules, saved] = await Promise.all([
    db.recurringRule.findMany({ where: { workspaceId: workspace.id, direction: "RECEIVABLE", pausedAt: null, currency: cur } }),
    db.scenario.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const open = sp.esc ? saved.find((x) => x.id === sp.esc) : undefined;
  if (open) Object.assign(sp, open.params as SP);
  const PRESETS: Record<string, SP> = { base: {}, optimista: { gastos: "-10", extra: "1000000" }, pesimista: { gastos: "20", sin: incomeRules[0]?.id } };
  const preset = sp.preset && PRESETS[sp.preset] ? sp.preset : sp.gastos || sp.extra || sp.sin || sp.invertir ? "custom" : "base";
  const v = preset === "custom" ? sp : PRESETS[preset];
  const months = 12;
  const expensePct = Number(v.gastos ?? 0) || 0;
  const extra = parseAmount(v.extra ?? "");
  const invest = parseAmount(v.invertir ?? "");
  const extras = [
    ...(extra && extra.gt(0) ? [{ date: periodStart(addMonths(period(today), 1)), amount: extra, description: "Ingreso extra" }] : []),
    ...(invest && invest.gt(0) ? Array.from({ length: months }, (_, i) => ({ date: new Date(periodStart(addMonths(period(today), i)).getTime() + 24 * 864e5), amount: invest.neg(), description: "Inversión mensual" })) : []),
  ];
  const [base, scen] = await Promise.all([
    forecast(db, workspace.id, { currency: cur, today, months }),
    forecast(db, workspace.id, { currency: cur, today, months, adjust: { expensePct, extra: extras, dropRuleIds: v.sin ? [v.sin] : [] } }),
  ]);
  const minOf = (rows: typeof base.rows) => rows.reduce((m, r) => (r.min.lt(m) ? r.min : m), rows[0].min);
  const diff = scen.rows.at(-1)!.end.minus(base.rows.at(-1)!.end);
  const label: Record<string, string> = { base: "Base", optimista: "Optimista", pesimista: "Pesimista", custom: "Personalizado" };

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Planificar" title="Simulador" />
      {tabs}
      <nav className="mv-chips" aria-label="Escenario">
        {["base", "optimista", "pesimista", "custom"].map((k) => <Link key={k} href={k === "custom" ? `${URL0}?tab=escenarios&gastos=0` : `${URL0}?tab=escenarios&preset=${k}`} className={preset === k ? "on" : ""}>{label[k]}</Link>)}
      </nav>
      {sp.lleno && <p className="mv-error">Ya tienes {MAX_SCENARIOS} escenarios guardados. Borra uno para guardar otro.</p>}
      <section className="mv-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[["En 12 meses (base)", base.rows.at(-1)!.end, false], ["Con el escenario", scen.rows.at(-1)!.end, false], ["Diferencia", diff, true], ["Punto más bajo", minOf(scen.rows), false]].map(([l, val, sign]) => (
          <div key={l as string}><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{l as string}</div><b className={`mv-num mv-amt ${(val as typeof diff).isNegative() ? "neg" : sign ? "pos" : ""}`} style={{ fontSize: 16 }}>{fm(val as typeof diff, sign ? { sign: true } : undefined)}</b></div>
        ))}
      </section>
      <form className="mv-card mv-web" method="get" action={`${URL0}#resultado`}>
        <input type="hidden" name="tab" value="escenarios" />
        <label className="field">Cambio en tus gastos (%)<input name="gastos" inputMode="numeric" defaultValue={String(expensePct)} /></label>
        <label className="field">Ingreso extra el mes que viene<input name="extra" inputMode="decimal" defaultValue={v.extra ?? ""} placeholder="0,00" /></label>
        <label className="field">Invertir por mes<input name="invertir" inputMode="decimal" defaultValue={v.invertir ?? ""} placeholder="0,00" /></label>
        <label className="field">Perder un ingreso<select name="sin" defaultValue={v.sin ?? ""}><option value="">Ninguno</option>{incomeRules.map((r) => <option key={r.id} value={r.id}>{r.description}</option>)}</select></label>
        <div><button className="btn pri" type="submit" style={{ width: "100%" }}>Simular</button></div>
      </form>
      <section id="resultado" className="mv-sec" style={{ gap: 8, scrollMarginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Mes a mes</h2>
        <div className="mv-card-list">{base.rows.map((b, i) => (
          <div key={b.period} className="mv-row">
            <span className="grow"><span className="t" style={{ display: "block" }}>{fmtPeriod(b.period)}</span><span className="s mv-amt">Base {fm(b.end)}</span></span>
            <span style={{ textAlign: "right" }}><b className={`mv-num mv-amt ${scen.rows[i].end.isNegative() ? "neg" : ""}`} style={{ display: "block" }}>{fm(scen.rows[i].end)}</b><span className={`mv-amt ${scen.rows[i].end.minus(b.end).isNegative() ? "neg" : "pos"}`} style={{ fontSize: 12, fontWeight: 700 }}>{fm(scen.rows[i].end.minus(b.end), { sign: true })}</span></span>
          </div>
        ))}</div>
      </section>
      {preset !== "base" && !open && (
        <form className="mv-card mv-web" action={saveScenarioAction}>
          <input type="hidden" name="back" value="/movil" />
          {(["gastos", "extra", "invertir", "sin"] as const).map((k) => <input key={k} type="hidden" name={k} value={k === "gastos" ? String(expensePct) : (v[k] ?? "")} />)}
          <label className="field">Guardar este escenario<input name="name" maxLength={60} placeholder="Ej.: si me cambio de trabajo" defaultValue={preset === "custom" ? "" : label[preset]} /></label>
          <div><button className="btn" type="submit" style={{ width: "100%" }}>Guardar escenario</button></div>
        </form>
      )}
      {saved.length > 0 && (
        <section className="mv-sec" style={{ gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Tus escenarios ({saved.length} de {MAX_SCENARIOS})</h2>
          <div className="mv-card-list">{saved.map((x) => (
            <div key={x.id} className="mv-row">
              <Link className="grow t" href={`${URL0}?tab=escenarios&esc=${x.id}#resultado`} style={open?.id === x.id ? { color: "var(--brand)" } : undefined}>{x.name}</Link>
              <form action={deleteScenarioAction}><input type="hidden" name="back" value="/movil" /><input type="hidden" name="id" value={x.id} /><ConfirmSubmit className="mv-btn" yes="Sí, borrar" question={`¿Borrar el escenario "${x.name}"?`}>Borrar</ConfirmSubmit></form>
            </div>
          ))}</div>
        </section>
      )}
    </main>
  );
}
