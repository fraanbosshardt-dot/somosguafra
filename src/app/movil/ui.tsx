"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";

// Íconos de línea del diseño de la app.
const PATHS = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  plus: "M12 5v14M5 12h14",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  up: "M12 19V5M5 12l7-7 7 7",
  swap: "M4 8h14l-3-3M20 16H6l3 3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  eyeOff: "M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6C3.8 9.3 2 12 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4.4-1",
  bell: "M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
} as const;
export type MvIconName = keyof typeof PATHS;

export function MvIcon({ name, stroke = 2, size = 20 }: { name: MvIconName; stroke?: number; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

// Barra de abajo: Inicio, Movimientos, cargar (+), Próximos y Explorar.
export function MvNav({ overdue }: { overdue: number }) {
  const path = usePathname();
  const at = (re: RegExp) => (re.test(path) ? "page" : undefined);
  // Cargar un movimiento ocupa toda la pantalla, sin barra.
  if (path.startsWith("/movil/cargar")) return null;
  return (
    <nav className="mv-nav" aria-label="Navegación principal">
      <Link href="/movil" aria-current={at(/^\/movil\/?$/)}><span><MvIcon name="home" /></span>Inicio</Link>
      <Link href="/movil/movimientos" aria-current={at(/^\/movil\/movimientos/)}><span><MvIcon name="list" /></span>Movimientos</Link>
      <Link href="/movil/cargar" className="add" aria-label="Cargar un movimiento"><span><MvIcon name="plus" stroke={2.6} /></span></Link>
      <Link href="/movil/proximos" aria-current={at(/^\/movil\/proximos/)}><span><MvIcon name="cal" />{overdue > 0 && <i className="badge" aria-label={`${overdue} atrasados`} />}</span>Próximos</Link>
      <Link href="/movil/explorar" aria-current={at(/^\/movil\/explorar/)}><span><MvIcon name="compass" /></span>Explorar</Link>
    </nav>
  );
}

// Un monto que cuenta hasta su valor cuando aparece o cambia (salvo con "reducir movimiento").
export function CountUp({ value, currency, className }: { value: number; currency: string; className?: string }) {
  const format = (n: number) => formatMoney(String(n), currency);
  const [shown, setShown] = useState(value);
  const from = useRef<number | null>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current ?? 0;
    from.current = value;
    if (reduce || start === value) { setShown(value); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 550);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{format(shown)}</span>;
}

// Ocultar o mostrar los montos (se recuerda en este celular).
export function HideAmounts() {
  const [hide, setHide] = useState(false);
  useEffect(() => {
    try { const v = localStorage.getItem("somosguafra-ocultar") === "1"; setHide(v); document.querySelector(".mv")?.setAttribute("data-hide", v ? "1" : "0"); } catch { /* sin almacenamiento */ }
  }, []);
  const toggle = () => {
    const v = !hide;
    setHide(v);
    document.querySelector(".mv")?.setAttribute("data-hide", v ? "1" : "0");
    try { localStorage.setItem("somosguafra-ocultar", v ? "1" : "0"); } catch { /* sin almacenamiento */ }
  };
  return (
    <button type="button" className="mv-ibtn" onClick={toggle} aria-label={hide ? "Mostrar montos" : "Ocultar montos"} aria-pressed={hide}>
      <MvIcon name={hide ? "eyeOff" : "eye"} />
    </button>
  );
}

// Aviso abajo de la pantalla que se va solo ("Listo, guardamos…").
export function Toast({ text }: { text: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 2600); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return (
    <div role="status" className="mv-toast">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8EC4A0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS.check} /></svg>
      <span>{text}</span>
    </div>
  );
}

// Confirmación que se ve unos segundos y se va (después de "Sí, lo pagué").
export function DoneCard({ text }: { text: string }) {
  const [phase, setPhase] = useState<"on" | "gone" | "off">("on");
  useEffect(() => {
    const a = setTimeout(() => setPhase("gone"), 2200);
    const b = setTimeout(() => setPhase("off"), 2650);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === "off") return null;
  return (
    <div role="status" className={`mv-done ${phase === "gone" ? "gone" : ""}`}>
      <span className="mv-tick"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS.check} /></svg></span>
      <b style={{ fontSize: 15, color: "#0F3A2D" }}>{text}</b>
    </div>
  );
}
