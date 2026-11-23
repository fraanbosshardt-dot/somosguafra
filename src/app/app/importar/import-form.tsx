"use client";
import { useRef, useState, useTransition } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { importAction } from "@/app/actions/modules";
import { reviewFile, type FileReview } from "./actions";
import { formatMoney } from "@/lib/money";
export function ImportForm({ accounts, pro }: { accounts: { id: string; name: string; currency: string }[]; pro: boolean }) {
  const root = useRef<HTMLDivElement>(null), [review, setReview] = useState<FileReview | null>(null), [error, setError] = useState(""), [pending, start] = useTransition();
  const [excluded, setExcluded] = useState<string[]>([]), [page, setPage] = useState(1), [matchesOnly, setMatchesOnly] = useState(false);
  const rows = review?.rows.filter(r => !matchesOnly || r.candidates.length) ?? [], pages = Math.max(1, Math.ceil(rows.length/20));
  const inspect = () => { const form = root.current?.querySelector("form"); if (!form) return; const fd = new FormData(form); start(async () => { setError(""); const result = await reviewFile(fd); if ("error" in result) { setReview(null); setError(result.error); } else { setReview(result); setExcluded(result.rows.filter(r=>r.repeatedInFile).map(r=>r.key)); setPage(1); } }); };
  return <div ref={root}><ActionForm action={importAction} className="product-form">
    <div className="frow"><label className="field">Archivo<input type="file" name="file" accept={pro ? ".csv,.xlsx,.ofx,.qfx" : ".csv"} onChange={() => { setReview(null); setError(""); setExcluded([]); }} /></label><label className="field">Cuenta<select name="accountId" onChange={() => { setReview(null); setExcluded([]); }}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label></div>
    <p className="sub">Los negativos son gastos y los positivos, ingresos. Primero revisá el archivo. La importación no conecta ni modifica tu banco. {pro ? "Las coincidencias son orientativas: confirmá vos qué filas omitir." : "CSV disponible en Gratis. Excel, OFX y comparación con cargas manuales son Pro."}</p>
    <div className="acts"><button className="btn" type="button" disabled={pending} onClick={inspect}>{pending ? "Revisando…" : review ? "Volver a revisar" : "Revisar archivo"}</button></div>
    {error && <p role="alert" className="notice r">{error}</p>}
    {review && <section className="product-section import-review"><input type="hidden" name="reviewFingerprint" value={review.fingerprint} />{excluded.map(key => <input type="hidden" key={key} name="exclude" value={key} />)}
      <h3>Revisión antes de guardar</h3><p role="status">{review.count-excluded.length} por importar · {review.duplicates} filas repetidas omitidas · {excluded.length} omitidas por vos.</p>
      {review.rows.some(r=>r.repeatedInFile) && <p className="notice a">Hay filas idénticas dentro del archivo. Quedan marcadas para omitir, pero podés incluirlas si reconocés que son operaciones diferentes. Revisá antes de confirmar.</p>}
      {review.errors.length > 0 && <details className="more"><summary>Hay filas con errores que no se importarán</summary><ul>{review.errors.map(e => <li key={e.line}>Línea {e.line}: {e.reason}</li>)}</ul></details>}
      {review.assisted && <label className="simtg"><input type="checkbox" checked={matchesOnly} onChange={e => { setMatchesOnly(e.target.checked); setPage(1); }} /><span>Ver solo posibles coincidencias con movimientos registrados</span></label>}
      <div className="list">{rows.slice((page-1)*20,page*20).map(r => <div className="import-review-row" key={r.key}><div className="grow"><b>{r.description}</b><div className="s">{r.date} · {formatMoney(r.amount, review.currency)}{r.repeatedInFile?" · fila repetida en este archivo":""}</div>{r.candidates.length > 0 && <p className="sub">Puede coincidir con: {r.candidates.map(c => `${c.description} (${c.date})`).join("; ")}. Revisá en Movimientos; no se fusiona ni elimina nada automáticamente.</p>}</div><label className="simtg"><input type="checkbox" checked={excluded.includes(r.key)} onChange={e => setExcluded(x => e.target.checked ? [...x,r.key] : x.filter(k => k !== r.key))} /><span>Omitir esta fila</span></label></div>)}</div>
      {pages > 1 && <div className="acts"><button className="btn sm" type="button" disabled={page === 1} onClick={() => setPage(p => p-1)}>Anterior</button><span>Página {page} de {pages}</span><button className="btn sm" type="button" disabled={page === pages} onClick={() => setPage(p => p+1)}>Siguiente</button></div>}
      <div className="acts" style={{marginTop:18}}><Submit name="confirm" value="1" disabled={review.count === excluded.length} pending="Importando…">Confirmar importación</Submit></div>
    </section>}
  </ActionForm></div>;
}
