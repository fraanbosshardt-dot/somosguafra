"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "./brand";
import { AppCta, useHasSession } from "./app-cta";
import { ThemeButton } from "./theme";

const LINKS: [string, string][] = [["funciones", "Funciones"], ["como", "Cómo funciona"], ["agro", "Para el campo"], ["planes", "Precios"], ["preguntas", "Preguntas"]];

// Barra de la parte pública: acompaña al bajar y se vuelve semitransparente.
// En la landing, los enlaces bajan suave hasta cada sección; desde otras páginas, llevan a la landing.
export function PublicNav({ logged: loggedServer }: { logged: boolean }) {
  const logged = useHasSession() || loggedServer;
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // Si se llega con #seccion desde otra página, baja suave al cargar.
  useEffect(() => {
    if (path !== "/" || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
  }, [path]);
  const go = (id: string) => (e: React.MouseEvent) => {
    if (path !== "/") return; // otra página: navega a /#id
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <header className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
      <div className="lp-w lp-navin">
        <Brand />
        <nav className="lp-links" aria-label="Secciones">
          {LINKS.map(([id, label]) => <Link key={id} href={`/#${id}`} onClick={go(id)} scroll={false}>{label}</Link>)}
        </nav>
        <div className="lp-cta-top"><ThemeButton />{logged ? <AppCta className="btn pri" label="Crear cuenta" logged navigation /> : <><a className="btn ghost" href="/ingresar">Ingresar</a><a className="btn pri" href="/registro">Crear cuenta</a></>}</div>
      </div>
    </header>
  );
}
