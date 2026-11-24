"use client";

import { useId, useRef } from "react";
import type { ReactNode } from "react";

// Keep the form mounted when closed so a draft survives inspecting another item.
export function EditPanel({ title, label = "Editar", children }: { title: string; label?: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  return <>
    <button type="button" className="btn sm" ref={trigger} onClick={() => dialog.current?.showModal()}>{label}</button>
    <dialog className="edit-panel" ref={dialog} aria-labelledby={id} onClose={() => trigger.current?.focus()}>
      <div className="edit-panel-head"><h2 id={id}>{title}</h2><button type="button" className="btn sm" onClick={() => dialog.current?.close()} aria-label={`Cerrar ${title}`}>Cerrar</button></div>
      <div className="edit-panel-content">{children}</div>
      <div className="edit-panel-footer"><button type="button" className="btn" onClick={() => dialog.current?.close()}>Volver a la lista</button></div>
    </dialog>
  </>;
}
