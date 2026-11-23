"use client";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { experienceAction } from "./actions";
export function PreferenceForm({ mode, accounts, categories }: { mode: "favorite" | "rule"; accounts: { id: string; name: string; currency: string }[]; categories: { id: string; name: string; kind: string }[] }) {
  const [kind, setKind] = useState("EXPENSE");
  return <ActionForm action={experienceAction} className="product-form" resetOnOk>
    <input type="hidden" name="action" value={mode} />
    <div className="frow"><label className="field">{mode === "rule" ? "Si el concepto contiene" : "Concepto habitual"}<input name="name" required maxLength={80} minLength={mode === "rule" ? 3 : 1} placeholder={mode === "rule" ? "Ej.: supermercado" : "Ej.: Compra de alimentos"} /></label><label className="field">Tipo<select name="kind" value={kind} onChange={e => setKind(e.target.value)}><option value="EXPENSE">Gasto</option><option value="INCOME">Ingreso</option></select></label></div>
    <div className="frow">{mode === "favorite" && <label className="field">Cuenta<select name="accountId" required>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>}
      <label className="field">Categoría<select name="categoryId" key={kind} required={mode === "rule"}><option value="">{mode === "rule" ? "Elegí una categoría" : "Elegir al cargar"}</option>{categories.filter(c => c.kind === kind).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    <div className="acts"><Submit>Guardar {mode === "rule" ? "regla" : "favorito"}</Submit></div>
  </ActionForm>;
}
