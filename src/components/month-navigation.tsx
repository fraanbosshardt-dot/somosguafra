import Link from "next/link";
import { fmtPeriod } from "@/lib/dates";

export function MonthNavigation({ month, previous, next, label = "Mes seleccionado" }: { month: string; previous: string; next?: string; label?: string }) {
  const arrow = (back: boolean) => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={back ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} /></svg>;
  return <nav className="month-navigation" aria-label={label}>
    <Link className="month-arrow" href={previous} aria-label="Mes anterior">{arrow(true)}</Link>
    <div className="month-value"><span>Mes</span><strong>{fmtPeriod(month)}</strong></div>
    {next ? <Link className="month-arrow" href={next} aria-label="Mes siguiente">{arrow(false)}</Link> : <span className="month-arrow" aria-hidden="true">{arrow(false)}</span>}
  </nav>;
}
