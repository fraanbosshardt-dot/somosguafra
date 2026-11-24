import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { insights } from "@/server/insights";
import { todayIn } from "@/lib/dates";
import { MvBackHead } from "../../head";
import { MvIcon } from "../../ui";
import { toMovil } from "../../links";

export const metadata: Metadata = { title: "Alertas y consejos" };
const LEVEL = {
  urgent: { label: "Urgente", bg: "#FDECEA", fg: "#A3201D" },
  warn: { label: "Atención", bg: "#FFF5E8", fg: "#7A3E00" },
  info: { label: "Consejo", bg: "#EDF3FB", fg: "#1F4F8F" },
  good: { label: "Bien", bg: "#EEF6F1", fg: "#16493A" },
} as const;

// Salen de los propios datos: atrasos, meses en rojo, presupuestos pasados, tarjetas que vencen…
export default async function AlertasMovil() {
  const { workspace } = await requireWorkspace();
  const list = await insights(getDb(), workspace.id, workspace.baseCurrency, todayIn(workspace.timezone));
  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Patrimonio y análisis" title="Alertas y consejos" />
      <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Salen de tus propios datos y se actualizan cada vez que cargas algo.</p>
      {list.length ? (
        <div className="mv-card-list mv-cas">
          {list.map((i, k) => (
            <Link key={k} className="mv-row" href={toMovil(i.href)} style={{ alignItems: "flex-start" }}>
              <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: LEVEL[i.level].bg, color: LEVEL[i.level].fg }}>{LEVEL[i.level].label}</span>
                <span className="t">{i.title}</span>
                {i.detail && <span className="s">{i.detail}</span>}
              </span>
              <span style={{ color: "var(--faint)", alignSelf: "center" }}><MvIcon name="chev" /></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mv-card mv-empty">No hay nada que revisar. Si tienes pagos atrasados, meses en rojo o presupuestos pasados, te avisamos acá.</div>
      )}
    </main>
  );
}
