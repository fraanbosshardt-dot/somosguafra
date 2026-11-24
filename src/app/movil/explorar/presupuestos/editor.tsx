"use client";
import { useState } from "react";
import { dec, parseAmount, ZERO } from "@/lib/money";
import { saveBudgetAction } from "@/app/actions/modules";
import { MvForm, MvSubmit } from "../../form-ui";

type Cat = { id: string; name: string; avg: number; limit: string | null; projectRemaining: boolean };
const fmt = (n: number | string) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec(n).mod(1).isZero() ? 0 : 2, maximumFractionDigits: 2 }).format(n as number);
const nice = (n: number) => { const step = n >= 100000 ? 5000 : n >= 10000 ? 1000 : 100; return Math.ceil(n / step) * step; };

// Mismo editor que la web: solo las categorías con límite, se agregan de a una, con un monto sugerido.
export function MvBudgetEditor({ period, cats, symbol, hasBudget }: { period: string; cats: Cat[]; symbol: string; hasBudget: boolean }) {
  const start = hasBudget ? cats.filter((c) => c.limit) : [...cats].filter((c) => c.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 5);
  const [rows, setRows] = useState(start.map((c) => ({ id: c.id, value: c.limit ? fmt(c.limit) : fmt(nice(c.avg)), project: c.projectRemaining })));
  const byId = new Map(cats.map((c) => [c.id, c]));
  const free = cats.filter((c) => !rows.some((r) => r.id === c.id)).sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));
  const total = rows.reduce((s, r) => s.plus(parseAmount(r.value) ?? ZERO), ZERO);
  const add = (id: string) => { const c = byId.get(id); if (c) setRows((r) => [...r, { id, value: c.avg > 0 ? fmt(nice(c.avg)) : "", project: false }]); };
  return (
    <MvForm action={saveBudgetAction}>
      <input type="hidden" name="period" value={period} />
      {!hasBudget && rows.length > 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Te propusimos las categorías en las que más gastas, con lo que gastas en promedio. Ajusta los montos o quita las que no quieras controlar.</p>}
      {rows.map((r, i) => {
        const c = byId.get(r.id)!;
        return (
          <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 6, borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span><b style={{ fontSize: 15 }}>{c.name}</b>{c.avg > 0 && <span style={{ display: "block", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Gastas ~{symbol} {fmt(Math.round(c.avg))} por mes</span>}</span>
              <button type="button" className="mv-ibtn" style={{ width: 36, height: 36 }} aria-label={`Quitar ${c.name}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>×</button>
            </div>
            <input className="mv-input" name={`limit:${r.id}`} inputMode="decimal" value={r.value} placeholder="0" aria-label={`Límite para ${c.name}`} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
              <input type="checkbox" name={`project:${r.id}`} checked={r.project} style={{ width: 18, height: 18, accentColor: "var(--brand)" }} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, project: e.target.checked } : y)))} />
              Incluir lo que queda en la proyección
            </label>
          </div>
        );
      })}
      {rows.length > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>Total</span><span className="mv-num">{symbol} {fmt(total.toFixed(2))}</span></div>}
      {free.length > 0 && (
        <select className="mv-input" aria-label="Agregar una categoría" value="" onChange={(e) => add(e.target.value)}>
          <option value="">+ Agregar una categoría…</option>
          {free.map((c) => <option key={c.id} value={c.id}>{c.name}{c.avg > 0 ? ` (~${symbol} ${fmt(Math.round(c.avg))})` : ""}</option>)}
        </select>
      )}
      <MvSubmit>Guardar presupuesto</MvSubmit>
    </MvForm>
  );
}
