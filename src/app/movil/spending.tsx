"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/money";

const COLORS = ["#16493A", "#4A8669", "#E8A24A", "#A9C9B6"];

// "Gastos del mes": anillo con las 4 categorías que más pesan. Tocar una muestra su parte.
export function SpendingDonut({ cats, currency }: { cats: { name: string; total: number }[]; currency: string }) {
  const [sel, setSel] = useState(0);
  const total = cats.reduce((s, c) => s + c.total, 0) || 1;
  const C = 2 * Math.PI * 38;
  let acc = 0;
  const arcs = cats.map((c, i) => {
    const len = (C * c.total) / total;
    const a = { color: COLORS[i], w: i === sel ? 14 : 9, len: Math.max(0, len - 3), off: -acc };
    acc += len;
    return a;
  });
  return (
    <div className="mv-card mv-donut-wrap">
      <div className="mv-donut">
        <svg aria-hidden="true" width="96" height="96" viewBox="0 0 96 96">
          {arcs.map((a, i) => <circle key={i} cx="48" cy="48" r="38" fill="none" stroke={a.color} strokeWidth={a.w} strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={a.off} style={{ transition: "stroke-width .2s" }} />)}
        </svg>
        <b className="mv-num">{Math.round((cats[sel]?.total ?? 0) / total * 100)} %</b>
      </div>
      <div className="mv-cats">
        {cats.map((c, i) => (
          <button key={c.name} type="button" className="mv-cat" aria-pressed={i === sel} onClick={() => setSel(i)}>
            <i style={{ background: COLORS[i] }} /><span>{c.name}</span><b className="mv-num mv-amt">{formatMoney(String(c.total), currency)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}
