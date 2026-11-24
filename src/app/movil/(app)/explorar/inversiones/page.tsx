import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { investmentsOverview, latestRates } from "@/server/wealth";
import { ensureFreshRates } from "@/server/fx";
import { ASSET_CLASSES } from "@/server/quotes";
import { dec, formatMoney, round2, ZERO } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { ActionForm, Submit } from "@/components/forms";
import { deleteInvestmentAction, holdingTradeAction, investmentMoveAction, manualPriceAction, valuationAction } from "@/app/actions/modules";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CURRENCIES } from "@/lib/countries";
import { AddInvestment } from "@/app/app/inversiones/add-investment";
import { MvBackHead } from "../../head";
import { CountUp, Toast } from "../../ui";
import { WealthTabs } from "../patrimonio/tabs";

export const metadata: Metadata = { title: "Inversiones" };
const NOTICE: Record<string, string> = { borrada: "Listo, eliminamos la inversión.", guardada: "Listo, agregamos la inversión.", operacion: "Listo, registramos la operación.", precio: "Listo, actualizamos el precio." };
const qtyFmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 8 });
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")} %`;

function DeleteInv({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteInvestmentAction} className="mv-fs mv-del">
      <input type="hidden" name="investmentId" value={id} />
      <span style={{ fontSize: 13, color: "var(--muted)" }}>¿La cargaste por error? Se borran sus movimientos y el dinero que salió de una cuenta vuelve.</span>
      <ConfirmSubmit className="mv-btn mv-danger" question={`¿Eliminar ${name} con todos sus movimientos? No se puede deshacer.`} yes="Sí, eliminar">Eliminar inversión</ConfirmSubmit>
    </form>
  );
}

// Bonos, acciones, cripto, FCI y plazos fijos con su cotización (mismo cálculo que la web).
export default async function InversionesMovil({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const cur = workspace.baseCurrency;
  await ensureFreshRates(db);
  const [list, accounts, rates] = await Promise.all([
    investmentsOverview(db, workspace.id),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    latestRates(db, workspace.id, cur),
  ]);
  const toBase = (v: typeof ZERO, c: string) => (c === cur ? v : rates.get(c) ? round2(v.times(rates.get(c)!.rate)) : null);
  const usdRate = cur === "USD" ? dec(1) : rates.get("USD")?.rate ?? null;
  let value = ZERO, invested = ZERO;
  const missing = new Set<string>();
  for (const i of list) {
    const v = toBase(i.value, i.inv.currency), c = toBase(i.invested, i.inv.currency);
    if (v == null || c == null) { missing.add(i.inv.currency); continue; }
    value = value.plus(v); invested = invested.plus(c);
  }
  const gain = value.minus(invested);
  const today = isoDate(todayIn(workspace.timezone));
  const holdings = list.filter((i) => i.holding), byAmount = list.filter((i) => !i.holding);
  const accFor = (c: string) => accounts.filter((a) => a.currency === c);
  const movs = (items: { id: string; kind: string; quantity: unknown; date: Date; amount: Parameters<typeof formatMoney>[0] }[], c: string) => (
    <div className="mv-card-list" style={{ margin: "0 -16px" }}>{items.map((m) => (
      <div className="mv-row" key={m.id}><span className="grow"><span className="t" style={{ display: "block" }}>{m.kind === "BUY" ? "Compra" : m.kind === "SELL" ? "Venta" : m.kind === "YIELD" ? "Renta o dividendo" : m.kind === "CONTRIBUTION" ? "Aporte" : m.kind === "WITHDRAWAL" ? "Retiro" : m.kind}{m.quantity ? ` · ${qtyFmt(Number(m.quantity))}` : ""}</span><span className="s">{fmtDate(m.date)}</span></span><span className="v mv-num mv-amt">{formatMoney(m.amount, c)}</span></div>
    ))}</div>
  );
  return (
    <main className="mv-main">
      {Object.entries(NOTICE).map(([k, t]) => sp[k] && <Toast key={k} text={t} />)}
      <MvBackHead href="/movil/explorar" sub="Patrimonio y análisis" title="Inversiones" />
      <WealthTabs on="inv" />
      {list.length > 0 && (
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Vale hoy</div>
            <div style={{ fontSize: 32, letterSpacing: "-.02em" }}><CountUp className="mv-num mv-amt" value={value.toNumber()} currency={cur} /></div>
            {usdRate && cur !== "USD" && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }} className="mv-amt">{formatMoney(round2(value.dividedBy(usdRate)), "USD")}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Invertido</div><b className="mv-amt">{formatMoney(invested, cur)}</b></div>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Resultado</div><b className={`mv-amt ${gain.isNegative() ? "neg" : "pos"}`}>{formatMoney(gain, cur, { sign: true })}{invested.gt(0) ? ` (${pct(gain.dividedBy(invested).times(100).toNumber())})` : ""}</b></div>
          </div>
          {missing.size > 0 && <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No sumamos lo que está en {[...missing].join(", ")} porque falta su cotización (cárgala en Patrimonio).</p>}
        </section>
      )}

      {holdings.map((i) => {
        const h = i.holding!;
        const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, i.inv.currency, o);
        return (
          <details key={i.inv.id} className="mv-card mv-more">
            <summary>
              <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <span>{i.inv.ticker} <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{i.inv.kind}</span></span>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{qtyFmt(h.qty.toNumber())} {h.unitLabel}{h.price ? ` · ${fm(h.price)}${h.per100 ? " c/100" : ""}` : " · sin precio"}{h.changePct != null ? ` · ${pct(h.changePct)} hoy` : ""}</span>
              </span>
              <span style={{ textAlign: "right", marginRight: 10 }}><b className="mv-num mv-amt" style={{ display: "block" }}>{fm(i.value)}</b><span className={`mv-amt ${i.gain.isNegative() ? "neg" : "pos"}`} style={{ fontSize: 12, fontWeight: 700 }}>{fm(i.gain, { sign: true })}</span></span>
            </summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
              <span>Pagaste (costo)</span><b className="mv-amt" style={{ color: "var(--ink)" }}>{fm(i.invested)}</b>
              {!h.realized.isZero() && <><span>Ganancia ya cobrada</span><b className={`mv-amt ${h.realized.isNegative() ? "neg" : "pos"}`}>{fm(h.realized, { sign: true })}</b></>}
              <span>Precio</span><b style={{ color: "var(--ink)" }}>{h.auto ? "Automático" : "A mano"}{i.valuedAt ? ` · ${fmtDate(i.valuedAt)}` : ""}</b>
            </div>
            <ActionForm action={holdingTradeAction} className="mv-web">
              <input type="hidden" name="investmentId" value={i.inv.id} />
              <label className="field">Operación<select name="side"><option value="BUY">Compré más</option><option value="SELL">Vendí</option></select></label>
              <label className="field">Cantidad<input name="quantity" inputMode="decimal" placeholder="0" /></label>
              <label className="field">Monto total<input name="total" inputMode="decimal" placeholder="0,00" /></label>
              <label className="field">Fecha<input name="date" type="date" defaultValue={today} /></label>
              <label className="field">Cuenta<select name="accountId" defaultValue=""><option value="">No mover ninguna cuenta</option>{accFor(i.inv.currency).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <div><Submit className="btn">Registrar</Submit></div>
            </ActionForm>
            <ActionForm action={manualPriceAction} className="mv-web">
              <input type="hidden" name="investmentId" value={i.inv.id} />
              <label className="field">{i.inv.assetClass === "FCI" ? "Valor de la cuotaparte hoy" : `Precio a mano${h.per100 ? " (cada 100 nominales)" : ""}`}<input name="price" inputMode="decimal" placeholder={h.price ? h.price.toNumber().toLocaleString("es-AR") : "0,00"} /></label>
              <div><Submit className="btn">Guardar precio</Submit></div>
            </ActionForm>
            {i.inv.movements.length > 0 && movs(i.inv.movements.slice(0, 10), i.inv.currency)}
            <DeleteInv id={i.inv.id} name={i.inv.ticker ?? i.inv.name} />
          </details>
        );
      })}

      {byAmount.map((i) => {
        const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, i.inv.currency, o);
        const accs = accFor(i.inv.currency);
        return (
          <details key={i.inv.id} className="mv-card mv-more">
            <summary>
              <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}><span>{i.inv.name}</span><span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{i.inv.kind}{i.valuedAt ? ` · valuada el ${fmtDate(i.valuedAt)}` : ""}</span></span>
              <span style={{ textAlign: "right", marginRight: 10 }}><b className="mv-num mv-amt" style={{ display: "block" }}>{fm(i.value)}</b><span className={`mv-amt ${i.gain.isNegative() ? "neg" : "pos"}`} style={{ fontSize: 12, fontWeight: 700 }}>{fm(i.gain, { sign: true })}</span></span>
            </summary>
            <ActionForm action={investmentMoveAction} className="mv-web">
              <input type="hidden" name="investmentId" value={i.inv.id} />
              <label className="field">Movimiento<select name="kind"><option value="CONTRIBUTION">Aporte</option><option value="WITHDRAWAL">Retiro</option></select></label>
              <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" /></label>
              <label className="field">Cuenta<select name="accountId">{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              {accs.length ? <div><Submit className="btn">Registrar</Submit></div> : <p className="sub">Necesitas una cuenta en {i.inv.currency}.</p>}
            </ActionForm>
            <ActionForm action={valuationAction} className="mv-web">
              <input type="hidden" name="investmentId" value={i.inv.id} />
              <label className="field">¿Cuánto vale hoy?<input name="value" inputMode="decimal" defaultValue={i.value.toFixed(2).replace(".", ",")} /></label>
              <div><Submit className="btn">Actualizar valor</Submit></div>
            </ActionForm>
            {i.inv.movements.length > 0 && movs(i.inv.movements.slice(0, 8), i.inv.currency)}
            <DeleteInv id={i.inv.id} name={i.inv.name} />
          </details>
        );
      })}

      <details className="mv-card mv-more" open={list.length === 0 || !!sp.nueva}>
        <summary>Agregar inversión</summary>
        <div className="mv-web"><AddInvestment classes={ASSET_CLASSES} accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))} currencies={[cur, ...CURRENCIES.map((c) => c.code).filter((c) => c !== cur)]} base={cur} today={today} /></div>
      </details>
    </main>
  );
}
