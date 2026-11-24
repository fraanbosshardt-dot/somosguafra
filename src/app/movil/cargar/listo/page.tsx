import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/dates";
import { isCurrency } from "@/lib/countries";
import { leftToSpend } from "../../left";
import { CountUp } from "../../ui";

export const metadata: Metadata = { title: "Listo" };
const WORD: Record<string, string> = { EXPENSE: "Gasto guardado", INCOME: "Ingreso guardado", TRANSFER: "Transferencia guardada" };

// Confirmación después de guardar: qué se guardó y cómo queda lo que te queda hasta el cobro.
export default async function Listo({ searchParams }: { searchParams: Promise<{ tipo?: string; monto?: string; cur?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const tipo = sp.tipo && WORD[sp.tipo] ? sp.tipo : "EXPENSE";
  const cur = sp.cur && isCurrency(sp.cur) ? sp.cur : workspace.baseCurrency;
  const monto = /^\d{1,12}$/.test(sp.monto ?? "") ? sp.monto! : "0";
  const { left } = await leftToSpend(workspace, todayIn(workspace.timezone));
  return (
    <main className="mv-main" style={{ minHeight: "100dvh", alignItems: "center", textAlign: "center", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <div style={{ flex: 1 }} />
      <span className="mv-tick" style={{ width: 96, height: 96, background: "var(--mint)" }}>
        <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16493A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <h1 className="mv-h2" style={{ fontSize: 24 }}>{WORD[tipo]}</h1>
      <p className="mv-num" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--muted)" }}>{tipo === "INCOME" ? "+ " : ""}{formatMoney(monto, cur)}</p>
      <div className="mv-card" style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#33403A", textAlign: "left" }}>Ahora te queda hasta el cobro</span>
        <CountUp className={`mv-num ${left.isNegative() ? "neg" : ""}`} value={Number(left.toString())} currency={workspace.baseCurrency} />
      </div>
      <div style={{ flex: 1 }} />
      <Link className="mv-btn pri mv-big" href="/movil">Volver al inicio</Link>
      <Link className="mv-btn mv-big" href={`/movil/cargar${tipo === "INCOME" ? "?tipo=ingreso" : tipo === "TRANSFER" ? "?tipo=transferencia" : ""}`} style={{ borderColor: "var(--field-line)" }}>Cargar otro</Link>
    </main>
  );
}
