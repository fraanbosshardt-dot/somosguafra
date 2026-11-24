"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { updateGoalPlanAction } from "@/app/actions/modules";

const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Mueve el aporte mensual y ve cuándo llegarías; se puede guardar.
export function MvGoalSim({ goalId, left, planned, currency, today }: { goalId: string; left: number; planned: number; currency: string; today: string }) {
  const [v, setV] = useState(Math.ceil(planned));
  const max = Math.max(Math.round(planned * 3), Math.round(left / 2), 1000);
  const months = v > 0 ? Math.ceil(left / v) : null;
  const [y, m] = today.split("-").map(Number);
  const when = months != null ? new Date(Date.UTC(y, m - 1 + months, 1)) : null;
  return (
    <form action={updateGoalPlanAction} className="mv-fs" style={{ background: "var(--soft)", borderRadius: 14, padding: 12 }}>
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="monthly" value={String(v)} />
      <span style={{ fontSize: 14, fontWeight: 600 }}>Si aportas <b className="mv-num">{formatMoney(v, currency)}</b> por mes, llegas en <b>{when ? `${MES[when.getUTCMonth()]} ${when.getUTCFullYear()}` : "nunca"}</b>.</span>
      <input type="range" min={0} max={max} step={1} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Aporte mensual" style={{ width: "100%", accentColor: "var(--brand)" }} />
      <button className="mv-btn" type="submit" disabled={Math.ceil(planned) === v} style={{ flex: "none", height: 40, borderColor: "var(--field-line)" }}>Guardar este aporte</button>
    </form>
  );
}
