"use client";
import { startTransition, useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/auth";

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

// Formulario de la app: muestra el error arriba del botón con el estilo de la app.
export function MvForm({ action, children, className = "mv-fs" }: { action: Action; children: ReactNode; className?: string }) {
  const [state, run] = useActionState(action, null);
  const [edited, setEdited] = useState(false);
  return (
    <form
      className={className}
      method="post"
      noValidate
      onInput={() => { if (state?.error && !edited) setEdited(true); }}
      onSubmit={(e) => {
        e.preventDefault();
        setEdited(false);
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => run(fd));
      }}
    >
      {children}
      {state?.error && !edited && <p className="mv-error" role="alert">{state.error}</p>}
      {state?.ok && !edited && <p className="mv-ok" role="status">{state.ok}</p>}
    </form>
  );
}

export function MvSubmit({ children, className = "mv-btn pri mv-big" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>{pending ? "Guardando…" : children}</button>;
}
