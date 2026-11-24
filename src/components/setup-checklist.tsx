"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// Solo personaliza la guía en este dispositivo; no modifica datos ni la proyección.
export function SetupChecklist({ workspaceId, steps }: { workspaceId: string; steps: [boolean, string, string][] }) {
  const key = `guafra/setup-guide/${workspaceId}`;
  const [skipped, setSkipped] = useState<number[]>([]);
  useEffect(() => { try { const value = JSON.parse(localStorage.getItem(key) ?? "[]"); setSkipped(Array.isArray(value) ? value.filter(n => n === 1 || n === 2) : []); } catch { setSkipped([]); } }, [key]);
  function skip(index?: number) {
    const next = index === undefined ? [] : [...new Set([...skipped, index])];
    setSkipped(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* La guía sigue funcionando sin almacenamiento. */ }
  }
  const complete = steps.filter(([done], index) => done || skipped.includes(index)).length;
  if (steps.every(([done]) => done)) return null;
  if (complete === steps.length) return <div><button className="lnk" type="button" onClick={() => skip()}>Revisar guía inicial</button></div>;
  return <div className="card setup-guide">
    <div className="chead"><div><h3>Terminá de configurar</h3><p className="sub">{complete} de {steps.length} pasos revisados. Cargá lo que corresponde a tu situación.</p></div></div>
    <div className="setup-bar" aria-hidden="true"><i style={{ width: `${complete / steps.length * 100}%` }} /></div>
    <ol className="steps">{steps.map(([done, label, href], index) => <li key={href} className={done || skipped.includes(index) ? "ok" : ""}>
      <div>{done ? <span>{label}</span> : skipped.includes(index) ? <span>Omitido por ahora: {label}</span> : <><Link className="lnk" href={href}>{label}</Link>{(index === 1 || index === 2) && <button className="btn ghost sm" type="button" onClick={() => skip(index)}>{index === 1 ? "No tengo un ingreso fijo" : "No tengo gastos fijos"}</button>}</>}</div>
    </li>)}</ol>
    <p className="sub">Un ingreso habitual se programa como cobro que se repite. Si cobrás de forma variable, registrá cada ingreso en Movimientos. Omitir un paso no agrega importes a tu proyección.</p>
  </div>;
}
