"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { useRef } from "react";

// Escritorio: barra lateral. Celular: sección actual y menú nativo desplegable.
export function AdminNav({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const on = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  const startSection = () => { if (mobileMenu.current) mobileMenu.current.open = false; window.scrollTo({ top: 0, behavior: "instant" }); };
  const active = items.find(i => on(i.href));
  return (
    <>
    <nav className="adm-nav" aria-label="Secciones del panel">
      {items.map((i) => (
        <Link key={i.href} href={i.href} scroll={false} onNavigate={startSection} className={on(i.href) ? "on" : ""} aria-current={on(i.href) ? "page" : undefined}>
          <Icon name={i.icon as never} /><span>{i.label}</span>
        </Link>
      ))}
    </nav>
    <details key={path} ref={mobileMenu} className="adm-nav-mobile">
      <summary aria-label={`Secciones del panel. Actual: ${active?.label ?? "Panel interno"}`}>
        <Icon name={(active?.icon ?? "chart") as never} />
        <span className="adm-mobile-section"><small>Panel interno · Secciones</small><b>{active?.label ?? "Elegí una sección"}</b></span>
        <svg className="adm-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <nav aria-label="Secciones del panel en celular">
        {items.map(i => <Link key={i.href} href={i.href} scroll={false} onNavigate={startSection} className={on(i.href) ? "on" : ""} aria-current={on(i.href) ? "page" : undefined} onClick={() => { if (mobileMenu.current) mobileMenu.current.open = false; }}><Icon name={i.icon as never} /><span>{i.label}</span></Link>)}
      </nav>
    </details>
    </>
  );
}
