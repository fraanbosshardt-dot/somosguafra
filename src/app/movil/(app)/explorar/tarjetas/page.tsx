import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { cardGroups } from "@/server/cards";
import { formatMoney } from "@/lib/money";
import { fmtDate, todayIn } from "@/lib/dates";
import { ActionForm, Submit } from "@/components/forms";
import { createCardAction } from "@/app/actions/modules";
import { CardFields } from "@/app/app/tarjetas/card-fields";
import { MvBackHead } from "../../head";
import { Toast } from "../../ui";

export const metadata: Metadata = { title: "Tarjetas de crédito" };

export default async function TarjetasMovil({ searchParams }: { searchParams: Promise<{ borrada?: string; nueva?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [cards, accounts] = await Promise.all([
    cardGroups(db, workspace.id, today),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  const active = cards.filter((c) => c.card.active), off = cards.filter((c) => !c.card.active);
  const tile = (c: (typeof cards)[number]) => {
    const st = c.status, next = st.open[0], ch = c.child, chNext = ch?.status.open[0];
    const late = st.overdue || !!ch?.status.overdue;
    const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, c.card.currency);
    return (
      <Link key={c.card.id} href={`/movil/explorar/tarjetas/${c.card.id}`} className="mv-card mv-ctile">
        <span className="mv-cc">
          <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{c.card.issuer || "Tarjeta"}</span>
          <span style={{ fontSize: 15, letterSpacing: ".12em" }}>•••• {c.card.last4 ?? "····"}</span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{c.card.name}</span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          {!next && !chNext ? (
            <><span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Sin resúmenes por pagar</span><b className="pos" style={{ fontSize: 20 }}>Al día</b></>
          ) : (
            <><span style={{ fontSize: 13, fontWeight: 700, color: late ? "var(--neg)" : "var(--muted)" }}>{late ? "Atrasado · venció" : "Vence"} el {fmtDate((next ?? chNext)!.dueDate)}</span>
              <b className={`mv-num mv-amt ${late ? "neg" : ""}`} style={{ fontSize: 20 }}>{next ? fm(st.owed) : ""}{chNext ? `${next ? " + " : ""}${formatMoney(ch!.status.owed, ch!.card.currency)}` : ""}</b></>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Próximo resumen <span className="mv-amt">{fm(c.nextAmount)}</span>{c.usagePct != null ? ` · usas el ${c.usagePct} %` : ""}</span>
          {c.usagePct != null && c.usagePct > 0 && <span style={{ height: 6, borderRadius: 99, background: "#EDF0ED", overflow: "hidden", marginTop: 4 }}><i className="mv-grow-x" style={{ display: "block", height: "100%", width: `${Math.min(100, c.usagePct)}%`, background: c.overAlert ? "var(--neg)" : "var(--brand)" }} /></span>}
        </span>
      </Link>
    );
  };
  return (
    <main className="mv-main">
      {sp.borrada && <Toast text="Listo, eliminamos la tarjeta." />}
      <MvBackHead href="/movil/explorar" sub="Pagos y deudas" title="Tarjetas de crédito" />
      <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Cada compra se cuenta una sola vez, en su categoría y su mes. Pagar el resumen no es otro gasto.</p>
      {active.length > 0 && <div className="mv-cas" style={{ display: "flex", flexDirection: "column", gap: 12 }}>{active.map(tile)}</div>}
      <details className="mv-card mv-more" open={cards.length === 0 || sp.nueva === "1"}>
        <summary>Nueva tarjeta</summary>
        <ActionForm action={createCardAction} className="mv-web">
          <input type="hidden" name="back" value="/movil" />
          <CardFields accounts={accounts} base={workspace.baseCurrency} />
          <div><Submit>Crear tarjeta</Submit></div>
        </ActionForm>
      </details>
      {off.length > 0 && (
        <details className="mv-card mv-more">
          <summary>Dadas de baja ({off.length})</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{off.map(tile)}</div>
        </details>
      )}
    </main>
  );
}
