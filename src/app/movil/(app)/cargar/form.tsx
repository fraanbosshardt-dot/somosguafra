"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createMovementAction } from "@/app/actions/app";
import { formatMoney } from "@/lib/money";

type Kind = "EXPENSE" | "INCOME" | "TRANSFER";
type Account = { id: string; name: string; currency: string };
type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE" };

const WORD: Record<Kind, string> = { EXPENSE: "Gasto", INCOME: "Ingreso", TRANSFER: "Transferencia" };

// Cargar un movimiento en pasos: 1) cuánto, 2) en qué y con qué. Guarda con la misma acción que la web.
// Con pendingMode se carga algo a pagar o cobrar más adelante (va a Próximos), con la opción de que se repita.
export function CargarForm({ initialKind, accounts, categories, lastAccount, today, idem, pendingMode = false }: { initialKind: Kind; accounts: Account[]; categories: Category[]; lastAccount: string; today: string; idem: string; pendingMode?: boolean }) {
  const [state, run, pending] = useActionState(createMovementAction, null);
  const [step, setStep] = useState<1 | 2>(1);
  const [kind, setKind] = useState<Kind>(pendingMode && initialKind === "TRANSFER" ? "EXPENSE" : initialKind);
  const [repeat, setRepeat] = useState(false);
  const [digits, setDigits] = useState("");
  const [cat, setCat] = useState("");
  const [allCats, setAllCats] = useState(false);
  const [acc, setAcc] = useState(accounts.some((a) => a.id === lastAccount) ? lastAccount : accounts[0].id);
  const [to, setTo] = useState(accounts.find((a) => a.id !== acc)?.id ?? "");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<"hoy" | "ayer" | "otra">("hoy");
  const [date, setDate] = useState(today);

  const amount = Number(digits || "0");
  const cur = accounts.find((a) => a.id === acc)?.currency ?? "ARS";
  const kindCats = categories.filter((c) => c.kind === (kind === "INCOME" ? "INCOME" : "EXPENSE"));
  const shownCats = allCats ? kindCats : kindCats.slice(0, 6);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  const effective = when === "hoy" ? today : when === "ayer" ? (pendingMode ? tomorrow : yesterday) : date;
  const word = (k: Kind) => (pendingMode ? (k === "INCOME" ? "Cobro" : "Pago") : WORD[k]);
  const catName = categories.find((c) => c.id === cat)?.name ?? "";
  const description = note.trim() || (kind === "TRANSFER" ? "Transferencia" : catName || (pendingMode ? (kind === "INCOME" ? "Cobro" : "Pago") : WORD[kind]));
  const press = (k: string) => setDigits((d) => (k === "del" ? d.slice(0, -1) : k === "000" ? (d ? (d + "000").slice(0, 10) : "") : (d + k).replace(/^0+/, "").slice(0, 10)));
  const pickKind = (k: Kind) => { setKind(k); setCat(""); setAllCats(false); };
  const canSave = amount > 0 && (kind === "TRANSFER" ? !!to && to !== acc : true);

  return (
    <main className="mv-main mv-cargar" style={{ minHeight: "100dvh", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <header className="mv-head">
        {step === 1
          ? <Link className="mv-ibtn" href={pendingMode ? "/movil/proximos" : "/movil"} aria-label="Cerrar"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></Link>
          : <button type="button" className="mv-ibtn" onClick={() => setStep(1)} aria-label="Volver al monto"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></button>}
        <div className="mv-hello">{step === 1 ? (pendingMode ? "Pago o cobro a futuro" : "Nuevo movimiento") : <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 13, color: "var(--muted)" }}>{pendingMode ? (kind === "INCOME" ? "A cobrar" : "A pagar") : WORD[kind]}</span><span className={`mv-num ${kind === "INCOME" ? "pos" : ""}`}>{kind === "INCOME" ? "+ " : ""}{formatMoney(String(amount), cur)}</span></span>}</div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Paso {step} de 2</span>
      </header>

      {step === 1 && (
        <>
          <div role="group" aria-label="Tipo de movimiento" className="mv-seg">
            {(pendingMode ? ["EXPENSE", "INCOME"] as Kind[] : ["EXPENSE", "INCOME", "TRANSFER"] as Kind[]).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => pickKind(k)}>{pendingMode ? (k === "INCOME" ? "A cobrar" : "A pagar") : k === "TRANSFER" ? "Transferir" : WORD[k]}</button>
            ))}
          </div>
          <div className="mv-amount">
            <span>{pendingMode ? (kind === "INCOME" ? "¿Cuánto vas a cobrar?" : "¿Cuánto vas a pagar?") : kind === "EXPENSE" ? "¿Cuánto gastaste?" : kind === "INCOME" ? "¿Cuánto entró?" : "¿Cuánto vas a pasar?"}</span>
            <b key={digits.length % 2} className={`mv-num ${kind === "INCOME" ? "pos" : ""}`} style={{ fontSize: digits.length > 7 ? 44 : 56 }}>{kind === "INCOME" ? "+ " : ""}{formatMoney(String(amount), cur)}</b>
          </div>
          <div className="mv-keys">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"].map((k) => (
              <button key={k} type="button" onClick={() => press(k)} aria-label={k === "del" ? "Borrar" : k}>
                {k === "del" ? <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5h11v14H9l-6-7zM12 9l6 6M18 9l-6 6" /></svg> : k}
              </button>
            ))}
          </div>
          <button type="button" className="mv-btn pri mv-big" disabled={!amount} onClick={() => setStep(2)}>Siguiente</button>
        </>
      )}

      {step === 2 && (
        <form action={run} className="mv-step2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="idem" value={idem} />
          <input type="hidden" name="amount" value={String(amount)} />
          <input type="hidden" name="description" value={description} />
          <input type="hidden" name="back" value={pendingMode ? "/movil/proximos?guardado=1" : `/movil/cargar/listo?tipo=${kind}&monto=${amount}&cur=${cur}`} />
          {kind === "TRANSFER" ? (
            <>
              <input type="hidden" name="fromAccountId" value={acc} />
              <input type="hidden" name="toAccountId" value={to} />
              <input type="hidden" name="date" value={effective} />
            </>
          ) : (
            <>
              <input type="hidden" name="accountId" value={acc} />
              <input type="hidden" name="categoryId" value={cat} />
              <input type="hidden" name="status" value={pendingMode ? "PENDING" : "PAID"} />
              <input type="hidden" name={pendingMode ? "dueDate" : "effectiveDate"} value={effective} />
              {pendingMode && repeat && <><input type="hidden" name="repeat" value="on" /><input type="hidden" name="frequency" value="MONTHLY" /></>}
            </>
          )}

          {kind !== "TRANSFER" && (
            <fieldset className="mv-fs">
              <legend>{pendingMode ? "¿De qué es?" : kind === "EXPENSE" ? "¿En qué fue?" : "¿De dónde vino?"}</legend>
              <div className="mv-tiles mv-cas">
                {shownCats.map((c) => <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? "" : c.id)}>{c.name}</button>)}
              </div>
              {kindCats.length > 6 && <button type="button" className="mv-link" style={{ border: "none", background: "none", padding: 0 }} onClick={() => setAllCats(!allCats)} aria-expanded={allCats}>{allCats ? "Ver menos" : `Ver todas (${kindCats.length})`}</button>}
            </fieldset>
          )}

          <fieldset className="mv-fs">
            <legend>{kind === "TRANSFER" ? "¿Desde qué cuenta?" : pendingMode ? (kind === "EXPENSE" ? "¿Con qué lo vas a pagar?" : "¿A qué cuenta va a entrar?") : kind === "EXPENSE" ? "¿Con qué pagaste?" : "¿A qué cuenta entró?"}</legend>
            <div className="mv-chips">{accounts.map((a) => <button key={a.id} type="button" aria-pressed={acc === a.id} onClick={() => setAcc(a.id)}>{a.name}</button>)}</div>
          </fieldset>
          {kind === "TRANSFER" && (
            <fieldset className="mv-fs">
              <legend>¿Hacia qué cuenta?</legend>
              <div className="mv-chips">{accounts.filter((a) => a.id !== acc).map((a) => <button key={a.id} type="button" aria-pressed={to === a.id} onClick={() => setTo(a.id)}>{a.name}</button>)}</div>
            </fieldset>
          )}

          <fieldset className="mv-fs">
            <legend>{pendingMode ? (kind === "INCOME" ? "¿Cuándo lo cobras?" : "¿Cuándo vence?") : "Fecha"}</legend>
            <div className="mv-chips">
              {(["hoy", "ayer", "otra"] as const).map((w) => <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)}>{w === "hoy" ? "Hoy" : w === "ayer" ? (pendingMode ? "Mañana" : "Ayer") : "Otra fecha"}</button>)}
            </div>
            {when === "otra" && <input className="mv-input" type="date" aria-label="Elige la fecha" value={date} {...(pendingMode ? { min: today } : { max: today })} onChange={(e) => setDate(e.target.value)} />}
          </fieldset>
          {pendingMode && (
            <label className="mv-check">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
              <span><b>Se repite todos los meses</b><br /><span>Lo agregamos solo cada mes, el mismo día.</span></span>
            </label>
          )}

          <label className="mv-fs">
            <span className="mv-legend-lbl">{pendingMode ? "Nombre" : "Nota"} <span style={{ fontWeight: 600, color: "var(--muted)" }}>(opcional)</span></span>
            <input className="mv-input" type="text" value={note} maxLength={120} placeholder={pendingMode ? (kind === "INCOME" ? "Ej.: sueldo" : "Ej.: alquiler") : kind === "EXPENSE" ? "Ej.: compra de la semana" : "Ej.: lo que quieras recordar"} onChange={(e) => setNote(e.target.value)} />
          </label>

          {state?.error && <p role="alert" className="mv-error">{state.error}</p>}
          <button type="submit" className="mv-btn pri mv-big" disabled={!canSave || pending}>{pending ? "Guardando…" : `Guardar ${word(kind).toLowerCase()}`}</button>
        </form>
      )}
    </main>
  );
}
