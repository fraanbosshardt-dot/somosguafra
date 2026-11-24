import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { assetsOverview, netWorth } from "@/server/wealth";
import { ensureFreshRates } from "@/server/fx";
import { dec, formatMoney, round2 } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { ActionForm, Submit } from "@/components/forms";
import { createAssetAction, deleteAssetAction, rateAction, valuationAction } from "@/app/actions/modules";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CURRENCIES } from "@/lib/countries";
import { MvBackHead } from "../../head";
import { CountUp, Toast } from "../../ui";
import { WealthTabs } from "./tabs";

export const metadata: Metadata = { title: "Patrimonio neto" };
const GROUPS = ["Dinero", "Inversiones", "Bienes", "Tarjetas", "Deudas"] as const;


// Todo lo que tienes menos todo lo que debes (mismo cálculo que la web).
export default async function PatrimonioMovil({ searchParams }: { searchParams: Promise<{ en?: string; borrado?: string }> }) {
  const { workspace, modules } = await requireWorkspace();
  const db = getDb();
  const cur = workspace.baseCurrency;
  await ensureFreshRates(db);
  const [nw, assets] = await Promise.all([netWorth(db, workspace.id, cur), assetsOverview(db, workspace.id)]);
  const sp = await searchParams;
  const usdRate = cur !== "USD" ? nw.rates.get("USD")?.rate ?? null : null;
  const showUsd = sp.en === "USD" && !!usdRate;
  const fm = (v: Parameters<typeof formatMoney>[0]) => (showUsd ? formatMoney(round2(dec(v).dividedBy(usdRate!)), "USD") : formatMoney(v, cur));
  const heroVal = showUsd ? round2(nw.net.dividedBy(usdRate!)).toNumber() : nw.net.toNumber();
  return (
    <main className="mv-main">
      {sp.borrado && <Toast text="Listo, eliminamos el bien." />}
      <MvBackHead href="/movil/explorar" sub="Patrimonio y análisis" title="Patrimonio" />
      <WealthTabs on="pat" />
      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Patrimonio neto</div>
          <div style={{ fontSize: 32, letterSpacing: "-.02em" }} className={nw.net.isNegative() ? "neg" : ""}><CountUp className="mv-num mv-amt" value={heroVal} currency={showUsd ? "USD" : cur} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Lo que tienes</div><b className="mv-amt">{fm(nw.assets)}</b></div>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Lo que debes</div><b className="mv-amt">{fm(nw.liabilities.neg())}</b></div>
        </div>
        {usdRate && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link className={`mv-btn ${!showUsd ? "pri" : ""}`} href="/movil/explorar/patrimonio" style={{ height: 38, borderColor: "var(--field-line)" }}>En {cur}</Link>
            <Link className={`mv-btn ${showUsd ? "pri" : ""}`} href="/movil/explorar/patrimonio?en=USD" style={{ height: 38, borderColor: "var(--field-line)" }}>En dólares</Link>
          </div>
        )}
      </section>

      {nw.missingRates.length > 0 && (
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Para sumar lo que tienes en <b>{nw.missingRates.join(", ")}</b>, carga su cotización.</span>
          <ActionForm action={rateAction} className="mv-web">
            <label className="field">Moneda<select name="from">{nw.missingRates.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field">1 unidad = ¿cuántos {cur}?<input name="rate" inputMode="decimal" placeholder="Ej.: 1.415" /></label>
            <div><Submit className="btn">Guardar cotización</Submit></div>
          </ActionForm>
        </section>
      )}

      {GROUPS.map((g) => {
        const lines = nw.lines.filter((l) => l.group === g && !l.amount.isZero());
        if (!lines.length) return null;
        return (
          <section key={g} className="mv-sec" style={{ gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>{g}</h2>
            <div className="mv-card-list mv-cas">{lines.map((l, i) => (
              <div className="mv-row" key={i}>
                <span className="grow"><span className="t" style={{ display: "block" }}>{l.name}</span>{l.currency !== cur && <span className="s mv-amt">{formatMoney(l.amount, l.currency)}{l.inBase ? "" : " · sin cotización"}</span>}</span>
                <b className={`v mv-num mv-amt ${l.amount.isNegative() ? "neg" : ""}`}>{l.inBase ? fm(l.inBase) : formatMoney(l.amount, l.currency)}</b>
              </div>
            ))}</div>
          </section>
        );
      })}

      {modules.activos && (
        <section className="mv-sec" style={{ gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Bienes (inmuebles, vehículos y otros)</h2>
          {assets.map((a) => (
            <details key={a.asset.id} className="mv-card mv-more">
              <summary><span style={{ display: "flex", flexDirection: "column" }}><span>{a.asset.name}</span><span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{a.asset.kind}{a.valuedAt ? ` · valuado el ${fmtDate(a.valuedAt)}` : ""} · <span className="mv-amt">{formatMoney(a.value, a.asset.currency)}</span></span></span></summary>
              <ActionForm action={valuationAction} className="mv-web">
                <input type="hidden" name="assetId" value={a.asset.id} />
                <label className="field">Valor de hoy<input name="value" inputMode="decimal" defaultValue={a.value.toFixed(0)} /></label>
                <div><Submit className="btn">Guardar</Submit></div>
              </ActionForm>
              <form action={deleteAssetAction} className="mv-fs mv-del">
                <input type="hidden" name="assetId" value={a.asset.id} />
                <ConfirmSubmit className="mv-btn mv-danger" question={`¿Eliminar ${a.asset.name}? Se borra con sus valuaciones.`} yes="Sí, eliminar">Eliminar bien</ConfirmSubmit>
              </form>
            </details>
          ))}
          <details className="mv-card mv-more" open={assets.length === 0}>
            <summary>Nuevo bien</summary>
            <ActionForm action={createAssetAction} className="mv-web">
              <label className="field">Nombre<input name="name" placeholder="Ej.: departamento" /></label>
              <label className="field">Tipo<select name="kind">{["Inmueble", "Vehículo", "Negocio", "Otro"].map((k) => <option key={k}>{k}</option>)}</select></label>
              <label className="field">¿Cuánto vale hoy?<input name="value" inputMode="decimal" /></label>
              <label className="field">Moneda<select name="currency" defaultValue={cur}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label>
              <div><Submit>Guardar bien</Submit></div>
            </ActionForm>
          </details>
        </section>
      )}
    </main>
  );
}
