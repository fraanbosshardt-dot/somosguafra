import Link from "next/link";
import type { ReactNode } from "react";
import { MvIcon } from "./ui";

// Encabezado de una pantalla interna: flecha para volver, título y una acción opcional a la derecha.
export function MvBackHead({ href, title, sub, right }: { href: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="mv-head" style={{ justifyContent: "flex-start", gap: 12 }}>
      <Link className="mv-ibtn" href={href} aria-label="Volver"><MvIcon name="back" stroke={2.2} /></Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        {sub && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{sub}</div>}
        <h1 className="mv-hello" style={{ fontSize: 20, margin: 0 }}>{title}</h1>
      </div>
      {right}
    </header>
  );
}

// Tarjeta de cabecera con el número grande de la pantalla.
export function MvHero({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 32, letterSpacing: "-.02em" }}>{children}</div>
      {note && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{note}</div>}
    </section>
  );
}
