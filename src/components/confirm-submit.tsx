"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Botón que pide confirmación antes de enviar: abre un cuadro centrado con la pregunta y dos botones claros.
// Sirve dentro de cualquier <form action={...}> (eliminar, cancelar, adelantar).
// La pregunta puede traer una explicación después del "?": se muestra abajo, más chica.
export function ConfirmSubmit({ children, question, yes = "Sí", className = "btn sm", ariaLabel, title }: { children: React.ReactNode; question: string; yes?: string; className?: string; ariaLabel?: string; title?: string }) {
  const [ask, setAsk] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const id = useId();
  const cut = question.indexOf("?");
  const head = cut >= 0 ? question.slice(0, cut + 1) : question;
  const detail = cut >= 0 ? question.slice(cut + 1).trim() : "";
  const danger = /danger/.test(className) || /eliminar|borrar|baja|cancelar|quitar/i.test(yes);
  const close = () => setAsk(false);
  const go = () => {
    if (submitting.current) return;
    submitting.current = true;
    const f = btn.current?.form;
    setAsk(false);
    f?.requestSubmit();
  };
  useEffect(() => {
    if (!ask) return;
    submitting.current = false;
    const background = [...document.body.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== overlay.current);
    const previousInert = background.map(el => el.inert);
    background.forEach(el => { el.inert = true; });
    cancel.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
      if (!buttons?.length) { e.preventDefault(); return; }
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!dialog.current?.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
      background.forEach((el, i) => { el.inert = previousInert[i]; });
      btn.current?.focus();
    };
  }, [ask]);
  return (
    <>
      <button ref={btn} type="button" className={className} aria-label={ariaLabel} title={title} aria-haspopup="dialog" onClick={() => setAsk(true)}>{children}</button>
      {ask && typeof document !== "undefined" && createPortal(
        <div ref={overlay} className="cdlg-back" onMouseDown={close}>
          <div ref={dialog} className="cdlg" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={detail ? `${id}-d` : undefined} onMouseDown={(e) => e.stopPropagation()}>
            <span className={`cdlg-ic ${danger ? "r" : ""}`} aria-hidden="true">{danger ? "!" : "?"}</span>
            <h3 id={`${id}-t`}>{head}</h3>
            {detail && <p id={`${id}-d`}>{detail}</p>}
            <div className="cdlg-acts">
              <button ref={cancel} type="button" className="btn" onClick={close} autoFocus>Cancelar</button>
              <button type="button" className={`btn ${danger ? "danger" : "pri"}`} onClick={go}>{yes}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
