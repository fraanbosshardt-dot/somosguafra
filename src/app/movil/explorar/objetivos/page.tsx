import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { goalsOverview } from "@/server/planning";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtPeriod, todayIn } from "@/lib/dates";
import { contributeAction, createGoalAction, deleteGoalAction, editGoalAction } from "@/app/actions/modules";
import { FREE_LIMITS } from "@/server/plans";
import { CURRENCIES } from "@/lib/countries";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MvBackHead } from "../../head";
import { MvForm, MvSubmit } from "../../form-ui";
import { MvGoalSim } from "./sim";

export const metadata: Metadata = { title: "Objetivos de ahorro" };

export default async function ObjetivosMovil() {
  const { workspace, plan } = await requireWorkspace();
  const today = todayIn(workspace.timezone);
  const goals = await goalsOverview(getDb(), workspace.id, today);
  const limited = !(await canUse(plan, "ilimitado")) && goals.length >= FREE_LIMITS.goals;
  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Planificar" title="Objetivos de ahorro" />
      <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Cuánto separar por mes para llegar a cada meta.</p>

      {goals.map((g) => {
        const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, g.goal.currency);
        const tag = g.done ? ["Cumplido", "#EEF6F1", "#16493A"] : g.onTrack === false ? ["No llegas a la fecha", "#FFF5E8", "#7A3E00"] : g.onTrack ? ["En camino", "#EEF6F1", "#16493A"] : null;
        return (
          <section key={g.goal.id} className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <h2 className="mv-h2" style={{ fontSize: 17 }}>{g.goal.name}</h2>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Meta {fm(g.goal.targetAmount)}{g.goal.targetDate ? ` · para ${fmtDate(g.goal.targetDate)}` : ""}</div>
              </div>
              {tag && <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: tag[1], color: tag[2], whiteSpace: "nowrap" }}>{tag[0]}</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <b className="mv-num mv-amt" style={{ fontSize: 22 }}>{fm(g.saved)}</b>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>{Math.round(g.pct)} %</span>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }}><i className="mv-grow-x" style={{ display: "block", height: "100%", width: `${Math.max(2, g.pct)}%`, background: "var(--brand)", borderRadius: 99 }} /></div>
            {!g.done && (
              <div style={{ fontSize: 14, fontWeight: 600, display: "flex", flexDirection: "column", gap: 2 }}>
                <span>Te falta <b className="mv-amt">{fm(g.left)}</b>.</span>
                {g.monthsLeft && <span>Necesitas <b className="mv-amt">{fm(g.needed)}</b> por mes durante {g.monthsLeft} meses.</span>}
                {g.eta && <span>Con tu aporte llegas en {fmtPeriod(g.eta)}.</span>}
              </div>
            )}
            {!g.done && <MvGoalSim key={`${g.goal.id}:${g.goal.monthlyContribution ?? ""}:${g.goal.targetAmount}`} goalId={g.goal.id} left={g.left.toNumber()} planned={g.planned?.toNumber() ?? Math.max(1, g.needed.toNumber())} currency={g.goal.currency} today={today.toISOString().slice(0, 7)} />}
            <details className="mv-more">
              <summary style={{ fontSize: 14 }}>Sumar un aporte</summary>
              <MvForm action={contributeAction}>
                <input type="hidden" name="goalId" value={g.goal.id} />
                <label className="mv-lbl">¿Cuánto separaste?<input className="mv-input" name="amount" inputMode="decimal" placeholder="0,00" /></label>
                <MvSubmit>Sumar</MvSubmit>
              </MvForm>
            </details>
            <details className="mv-more">
              <summary style={{ fontSize: 14 }}>Editar o eliminar</summary>
              <MvForm action={editGoalAction}>
                <input type="hidden" name="goalId" value={g.goal.id} />
                <label className="mv-lbl">Nombre<input className="mv-input" name="name" maxLength={100} defaultValue={g.goal.name} /></label>
                <label className="mv-lbl">Meta ({g.goal.currency})<input className="mv-input" name="target" inputMode="decimal" defaultValue={g.goal.targetAmount.toFixed(2).replace(".", ",")} /></label>
                <label className="mv-lbl">Para cuándo (opcional)<input className="mv-input" name="targetDate" type="date" defaultValue={g.goal.targetDate?.toISOString().slice(0, 10) ?? ""} /></label>
                <label className="mv-lbl">Aporte mensual previsto (opcional)<input className="mv-input" name="monthly" inputMode="decimal" defaultValue={g.goal.monthlyContribution?.toFixed(2).replace(".", ",") ?? ""} /></label>
                <MvSubmit className="mv-btn mv-big">Guardar cambios</MvSubmit>
              </MvForm>
              <form action={deleteGoalAction} className="mv-fs mv-del">
                <input type="hidden" name="goalId" value={g.goal.id} />
                <ConfirmSubmit className="mv-btn mv-danger" question={`¿Eliminar el objetivo "${g.goal.name}"?`} yes="Sí, eliminar">Eliminar objetivo</ConfirmSubmit>
              </form>
            </details>
          </section>
        );
      })}

      <details className="mv-card mv-more" open={goals.length === 0}>
        <summary>Nuevo objetivo</summary>
        {limited ? <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>El plan Gratis incluye {FREE_LIMITS.goals} objetivos. Con Pro no hay límite.</p> : (
          <MvForm action={createGoalAction}>
            <input type="hidden" name="back" value="/movil" />
            <label className="mv-lbl">Nombre<input className="mv-input" name="name" placeholder="Ej.: fondo de emergencia" /></label>
            <label className="mv-lbl">Meta<input className="mv-input" name="target" inputMode="decimal" placeholder="0,00" /></label>
            <label className="mv-lbl">Moneda<select className="mv-input" name="currency" defaultValue={workspace.baseCurrency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label>
            <label className="mv-lbl">Para cuándo (opcional)<input className="mv-input" name="targetDate" type="date" /></label>
            <label className="mv-lbl">Ya tengo (opcional)<input className="mv-input" name="saved" inputMode="decimal" placeholder="0,00" /></label>
            <label className="mv-lbl">Puedo aportar por mes (opcional)<input className="mv-input" name="monthly" inputMode="decimal" placeholder="0,00" /></label>
            <MvSubmit>Crear objetivo</MvSubmit>
          </MvForm>
        )}
      </details>
    </main>
  );
}
