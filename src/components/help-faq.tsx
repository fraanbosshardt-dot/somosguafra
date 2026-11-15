"use client";
import { useState } from "react";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function category(question: string) {
  const q = normalize(question);
  if (/tarjeta|cuota|prestamo|deuda/.test(q)) return "Tarjetas y deudas";
  if (/\bpro\b|suscrip|prueba|contrat|reembolso|mercado pago/.test(q)) return "Plan y pagos";
  if (/cuenta|correo|datos|sesion|banco|seguridad|telefono/.test(q)) return "Cuenta y seguridad";
  return "Usar la app";
}
export function HelpFaq({ items }: { items: [string, string][] }) {
  const [query, setQuery] = useState(""), [group, setGroup] = useState("Todas");
  const shown = items.filter(([q, a]) => (group === "Todas" || category(q) === group) && normalize(`${q} ${a}`).includes(normalize(query.trim())));
  return <>
    <div className="help-filters">
      <label className="field">Buscar en Ayuda<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej.: pagar, importar, tarjeta…" /></label>
      <label className="field">Tema<select value={group} onChange={(e) => setGroup(e.target.value)}>{["Todas", "Usar la app", "Tarjetas y deudas", "Plan y pagos", "Cuenta y seguridad"].map((label) => <option key={label}>{label}</option>)}</select></label>
    </div>
    <p className="sub" role="status">{shown.length} {shown.length === 1 ? "respuesta" : "respuestas"}{query.trim() && ` para «${query.trim()}»`}</p>
    <div className="list">{shown.map(([q, a]) => <details className="li" key={q} style={{ display: "block" }}><summary style={{ cursor: "pointer" }}>{q}</summary><p className="sub" style={{ margin: "10px 0 0", fontSize: 14 }}>{a}</p></details>)}</div>
    {!shown.length && <p>No encontramos una respuesta con esos filtros. Probá con otra palabra o escribinos desde el formulario.</p>}
  </>;
}
