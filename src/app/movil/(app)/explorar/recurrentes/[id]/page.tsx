import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { deleteRuleAction, endRuleAction, pauseRuleAction, saveRuleAction } from "@/app/actions/modules";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MvBackHead } from "../../../head";
import { MvForm, MvSubmit } from "../../../form-ui";
import { FREQ, MONTHLY_LIKE, nextDates } from "../shared";

export const metadata: Metadata = { title: "Pago que se repite" };

export default async function RecurrenteMovil({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const r = await db.recurringRule.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!r) notFound();
  const today = todayIn(workspace.timezone);
  const active = !r.endDate || r.endDate > today;
  const next = active ? (await nextDates(db, workspace.id, [r], today)).get(r.id) : null;
  const rec = r.direction === "RECEIVABLE";

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar/recurrentes" sub={rec ? "Cobro que se repite" : "Pago que se repite"} title={r.description} />
      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div className={`mv-num mv-amt ${rec ? "pos" : ""}`} style={{ fontSize: 32 }}>{rec ? "+ " : ""}{formatMoney(r.amount, r.currency)}</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{FREQ[r.frequency]}{r.dayOfMonth ? `, el día ${r.dayOfMonth}` : ""}{r.variableAmount ? " · monto aproximado" : ""}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
          {r.pausedAt ? "Está pausado." : next ? `Próximo: ${fmtDate(next)}` : ""}{r.endDate ? ` · ${active ? "hasta" : "terminó el"} ${fmtDate(r.endDate)}` : " · sin fecha de fin"}
        </div>
      </section>

      {active && (
        <section className="mv-sec">
          <h2 className="mv-h2" style={{ fontSize: 16 }}>Cambiar monto o día</h2>
          <MvForm action={saveRuleAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="back" value="/movil" />
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Vale desde la fecha que elijas. Lo anterior queda como estaba.</p>
            <label className="mv-lbl">Monto<input className="mv-input" name="amount" inputMode="decimal" defaultValue={r.amount.toFixed(2).replace(".", ",")} /></label>
            {MONTHLY_LIKE.includes(r.frequency) && <label className="mv-lbl">Día del mes<input className="mv-input" name="dayOfMonth" inputMode="numeric" defaultValue={r.dayOfMonth ?? r.startDate.getUTCDate()} /></label>}
            <label className="mv-lbl">Desde<input className="mv-input" name="from" type="date" defaultValue={isoDate(next ?? today)} /></label>
            <label className="mv-lbl">Hasta (vacío = sin fin)<input className="mv-input" name="endDate" type="date" defaultValue={r.endDate ? isoDate(r.endDate) : ""} /></label>
            <MvSubmit>Guardar cambios</MvSubmit>
          </MvForm>
        </section>
      )}

      {active && (
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 className="mv-h2" style={{ fontSize: 16 }}>Pausar o terminar</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}><b>Pausar</b>: deja de aparecer hasta que lo reanudes. <b>Terminar</b>: deja de repetirse desde hoy; lo que ya pagaste queda igual.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <form action={pauseRuleAction} style={{ flex: 1, display: "flex" }}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="pause" value={r.pausedAt ? "0" : "1"} /><input type="hidden" name="back" value="/movil" />
              <button className="mv-btn" type="submit" style={{ borderColor: "var(--field-line)" }}>{r.pausedAt ? "Reanudar" : "Pausar"}</button>
            </form>
            <form action={endRuleAction} style={{ flex: 1, display: "flex" }}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value="/movil" />
              <ConfirmSubmit className="mv-btn" question={`¿Terminar "${r.description}" desde hoy?`} yes="Sí, terminar">Terminar</ConfirmSubmit>
            </form>
          </div>
        </section>
      )}

      <form action={deleteRuleAction} className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value="/movil" />
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Borrar quita la regla y sus próximos pendientes. Lo que ya pagaste o cobraste queda en tus movimientos.</p>
        <ConfirmSubmit className="mv-btn mv-danger" question={`¿Borrar "${r.description}" y sus próximos pendientes?`} yes="Sí, borrar">Borrar</ConfirmSubmit>
      </form>
    </main>
  );
}
