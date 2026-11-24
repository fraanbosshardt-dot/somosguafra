"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { PRODUCT_GUIDES } from "@/lib/product-guide";
import { PRODUCT_TOURS, type ProductTour } from "@/lib/product-tours";

const viewedThisSession = new Set<string>();

function FirstUseGuide({ route, tour }: { route: string; tour: ProductTour }) {
  const [open, setOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);
  const [step, setStep] = useState(0);
  const contentId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const key = `guafra:guia:v1:${route}`;

  useEffect(() => {
    if (viewedThisSession.has(key)) return;
    viewedThisSession.add(key);
    try {
      if (localStorage.getItem(key) === "vista") return;
      localStorage.setItem(key, "vista");
    } catch { /* The guide still works if device storage is unavailable. */ }
    setFirstVisit(true);
  }, [key]);

  function move(next: number) {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function close() {
    setOpen(false);
    toggle.current?.focus();
  }

  return <section className="product-guide first-use-guide" aria-label={tour.title}>
    <button ref={toggle} type="button" className="guide-toggle" aria-expanded={open} aria-controls={contentId}
      onClick={() => { setStep(0); setFirstVisit(false); setOpen(!open); }}>{firstVisit ? "¿Primera vez? Ver guía paso a paso" : "Guía paso a paso"} <span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <div id={contentId} className="guide-content">
      <div className="guide-top"><span>{tour.title}</span><span>Paso {step + 1} de {tour.steps.length}</span></div>
      <h2 ref={heading} tabIndex={-1}>{tour.steps[step].title}</h2>
      <p>{tour.steps[step].text}</p>
      <div className="guide-controls">
        <button type="button" className="btn sm ghost" onClick={close}>Omitir guía</button>
        <div className="guide-step-buttons">
          {step > 0 && <button type="button" className="btn sm" onClick={() => move(step - 1)}>Anterior</button>}
          {step < tour.steps.length - 1
            ? <button type="button" className="btn sm pri" onClick={() => move(step + 1)}>Siguiente</button>
            : <button type="button" className="btn sm pri" onClick={close}>Empezar a usar</button>}
        </div>
      </div>
      <small>Podés seguir usando la pantalla. Volvé a abrir esta guía cuando quieras. <Link className="lnk" href="/app/ayuda">Más ayuda</Link></small>
    </div>}
  </section>;
}

export function ProductGuide() {
  const pathname = usePathname();
  if (!pathname.startsWith("/app/")) return null;
  const route = pathname.split("/").slice(2).join("/");
  const tour = PRODUCT_TOURS[route];
  if (tour) return <FirstUseGuide key={route} route={route} tour={tour} />;
  const guide = PRODUCT_GUIDES[route] ?? PRODUCT_GUIDES[pathname.split("/")[2]];
  if (!guide) return null;
  return <details className="product-guide"><summary>Guía de esta pantalla</summary><div><b>{guide.title}</b><p>{guide.text}</p><Link className="lnk" href={guide.href}>{guide.next}</Link><span aria-hidden="true"> · </span><Link className="lnk" href="/app/ayuda">Más ayuda</Link></div></details>;
}
