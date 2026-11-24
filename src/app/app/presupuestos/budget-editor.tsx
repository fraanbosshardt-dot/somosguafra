"use client";
// Armar el presupuesto sin una lista larga de "Sin límite": se ven solo las categorías con límite,
// se agregan de a una y Somos Guafra sugiere el monto con lo que gastaste los últimos meses.
import { parseAmount, dec, ZERO } from "@/lib/money";
import { useEffect, useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { saveBudgetAction } from "@/app/actions/modules";

type Cat = { id: string; name: string; avg: number; used: string; limit: string | null; projectRemaining: boolean };
const fmt = (n: number | string) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec(n).mod(1).isZero() ? 0 : 2, maximumFractionDigits: 2 }).format(n as number);
// Redondeo amigable de la sugerencia (ej.: 47.320 → 48.000).
const nice = (n: number) => { const step = n >= 100000 ? 5000 : n >= 10000 ? 1000 : 100; return Math.ceil(n / step) * step; };

export function BudgetEditor({ period, cats, symbol, hasBudget, ended }: { period: string; cats: Cat[]; symbol: string; hasBudget: boolean; ended: boolean }) {
  // Sin presupuesto: arranca con las categorías en las que más gastás (hasta 5), con la sugerencia puesta.
  const start = hasBudget ? cats.filter((c) => c.limit) : [...cats].filter((c) => c.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 5);
  const [rows, setRows] = useState(start.map((c) => ({ id: c.id, value: c.limit ? fmt(c.limit) : fmt(nice(c.avg)), project: c.projectRemaining })));
  const [pick, setPick] = useState("");
  const serverKey = JSON.stringify(cats.map((c) => [c.id, c.limit, c.projectRemaining]));
  useEffect(() => {
    if (hasBudget) setRows(cats.filter((c) => c.limit).map((c) => ({ id: c.id, value: fmt(c.limit!), project: c.projectRemaining })));
  // Solo los límites guardados sincronizan el editor; escribir no cambia esta clave.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey, hasBudget]);
  const byId = new Map(cats.map((c) => [c.id, c]));
  const free = cats.filter((c) => !rows.some((r) => r.id === c.id)).sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));
  const total = rows.reduce((sum, row) => sum.plus(parseAmount(row.value) ?? ZERO), ZERO);
  const add = (id: string) => { const c = byId.get(id); if (!c) return; setRows((r) => [...r, { id, value: c.avg > 0 ? fmt(nice(c.avg)) : "", project: false }]); setPick(""); };

  return (
    <ActionForm action={saveBudgetAction} style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 10 }}>
      <input type="hidden" name="period" value={period} />
      {!hasBudget && rows.length > 0 && <p className="sub" style={{ margin: 0 }}>Te sugerimos límites con el promedio de los tres meses anteriores, incluidos meses sin gastos. Si recién empezás, tomalos como referencia y ajustalos.</p>}
      {rows.length > 0 ? (
        <div className="bud-rows">
          {rows.map((r, i) => {
            const c = byId.get(r.id)!;
            const remainder = dec(parseAmount(r.value) ?? ZERO).minus(c.used);
            return (
              <div className="bud-row" key={r.id}>
                <div className="bud-name"><b>{c.name}</b>{c.avg > 0 && <span className="sub">Promedio de los 3 meses anteriores: {symbol} {fmt(c.avg)}</span>}</div>
                <label className="bud-amt"><span className="sr-only">Límite para {c.name}</span><em>{symbol}</em><input name={`limit:${r.id}`} inputMode="decimal" value={r.value} placeholder="0" onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} /></label>
                <label className="budget-project"><input type="checkbox" name={`project:${r.id}`} checked={r.project} onChange={(e) => setRows((x) => x.map((y, j) => j === i ? { ...y, project: e.target.checked } : y))} /><span>Contar el margen en mi flujo de caja<span className="budget-project-preview">{ended ? "Mes finalizado: no agrega estimaciones futuras." : r.project ? `Estimación adicional: ${symbol} ${fmt(remainder.gt(0) ? remainder.toFixed(2) : 0)} al final del mes.` : "Solo controla el límite; no agrega una estimación al flujo."}</span></span></label>
                <button type="button" className="dots" aria-label={`Quitar ${c.name}`} title="Quitar" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>×</button>
              </div>
            );
          })}
          <div className="bud-total"><span>Total del presupuesto</span><b className="num">{symbol} {fmt(total.toFixed(2))}</b></div>
        </div>
      ) : <p className="sub" style={{ margin: 0 }}>Elegí las categorías que querés controlar. Las demás no cuentan en el presupuesto.</p>}
      {free.length > 0 && (
        <div className="bud-add">
          <select aria-label="Agregar una categoría" value={pick} onChange={(e) => add(e.target.value)}>
            <option value="">+ Agregar una categoría…</option>
            {free.map((c) => <option key={c.id} value={c.id}>{c.name}{c.avg > 0 ? ` (promedio 3 meses: ${symbol} ${fmt(c.avg)})` : ""}</option>)}
          </select>
        </div>
      )}
      <div className="stm-foot"><p className="sub">Guardá para aplicar los límites y sus opciones. No mueve dinero. Quitar una categoría conserva sus gastos; solo quita el límite.</p><Submit>Guardar presupuesto</Submit></div>
    </ActionForm>
  );
}
