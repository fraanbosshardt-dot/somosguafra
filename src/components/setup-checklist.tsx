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
  const remaining = steps.map((step,index) => ({step,index})).filter(({step:[done],index}) => !done && !skipped.includes(index));
  return <section className="card setup-guide" aria-label="Configuración inicial">
    <div className="setup-guide-heading"><h3>Terminá de configurar</h3><span className="sub">{complete} de {steps.length} pasos revisados</span></div>
    <div className="setup-bar" role="progressbar" aria-label="Pasos revisados" aria-valuenow={complete} aria-valuemin={0} aria-valuemax={steps.length}><i style={{ width: `${complete / steps.length * 100}%` }} /></div>
    <ul className="setup-pending">{remaining.map(({step:[,label,href],index}) => <li key={href}>
      <span className="setup-step-number" aria-hidden="true">{index + 1}</span>
      <Link className="lnk" href={href}>{label}</Link>
      {(index === 1 || index === 2) && <button className="btn ghost sm" type="button" onClick={() => skip(index)} aria-label={`Omitir por ahora: ${label}`}>Omitir por ahora</button>}
    </li>)}</ul>
    <div className="setup-guide-footer">
      {complete > 0 && <details><summary>Ver pasos revisados ({complete})</summary><ul className="setup-completed">{steps.map(([done,label],index) => (done || skipped.includes(index)) && <li key={index}><span aria-hidden="true">{done ? "✓" : "−"}</span><span>{label}{!done && " · omitido por ahora"}</span></li>)}</ul></details>}
      <p className="sub">Omitir un paso no agrega importes a tu proyección.</p>
    </div>
  </section>;
}
