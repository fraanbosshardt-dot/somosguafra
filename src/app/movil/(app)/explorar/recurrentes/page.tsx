import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { createRuleAction } from "@/app/actions/modules";
import { MvBackHead } from "../../head";
import { MvForm, MvSubmit } from "../../form-ui";
import { MvIcon, Toast } from "../../ui";
import { FREQ, nextDates } from "./shared";

export const metadata: Metadata = { title: "Pagos que se repiten" };

export default async function RecurrentesMovil({ searchParams }: { searchParams: Promise<{ nueva?: string; borrada?: string; terminada?: string; guardada?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [all, accounts, cats] = await Promise.all([
    db.recurringRule.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { not: "CREDIT_CARD" } }, select: { id: true, name: true, currency: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.category.findMany({ where: { workspaceId: workspace.id, parentId: null, archived: false }, orderBy: { name: "asc" } }),
  ]);
  const replaced = new Set(all.map((r) => r.previousVersionId).filter(Boolean));
  const rules = all.filter((r) => !r.endDate || r.endDate > today);
  const ended = all.filter((r) => r.endDate && r.endDate <= today && !replaced.has(r.id));
  const next = await nextDates(db, workspace.id, rules, today);
  rules.sort((a, b) => (next.get(a.id)?.getTime() ?? Infinity) - (next.get(b.id)?.getTime() ?? Infinity));
  const row = (r: (typeof all)[number], active: boolean) => {
    const rec = r.direction === "RECEIVABLE";
    const n = active ? next.get(r.id) : null;
    return (
      <Link key={r.id} className="mv-row" href={`/movil/explorar/recurrentes/${r.id}`} style={r.pausedAt || !active ? { opacity: 0.65 } : undefined}>
        <span className="mv-date" style={{ background: rec ? "#EEF6F1" : "var(--soft)", color: rec ? "var(--pos)" : "var(--brand)" }}><MvIcon name="repeat" /></span>
        <span className="grow">
          <span className="t" style={{ display: "block" }}>{r.description}</span>
          <span className="s">{r.pausedAt ? "Pausado" : !active ? `Terminó el ${fmtDate(r.endDate!)}` : `${FREQ[r.frequency]}${n ? ` · próximo ${fmtDate(n)}` : ""}`}</span>
        </span>
        <b className={`v mv-num mv-amt ${rec ? "pos" : ""}`}>{rec ? "+ " : ""}{formatMoney(r.amount, r.currency)}</b>
      </Link>
    );
  };

  return (
    <main className="mv-main">
      {sp.borrada && <Toast text="Listo, se borró. Lo ya pagado quedó en tus movimientos." />}
      {sp.guardada && <Toast text="Listo, guardamos los cambios." />}
      {sp.terminada && <Toast text="Listo, dejó de repetirse desde hoy." />}
      <MvBackHead href="/movil/explorar" sub="Pagos y deudas" title="Pagos que se repiten" />
      <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Sueldo, alquiler, servicios y cuotas. Aparecen solos en Próximos y en el flujo de caja.</p>

      {rules.length > 0 ? <div className="mv-card-list mv-cas">{rules.map((r) => row(r, true))}</div> : <div className="mv-card mv-empty">Todavía no tienes pagos que se repiten.</div>}

      <details className="mv-card mv-more" open={sp.nueva === "1" || rules.length === 0}>
        <summary>Nuevo pago o cobro que se repite</summary>
        <MvForm action={createRuleAction}>
          <input type="hidden" name="back" value="/movil" />
          <fieldset className="mv-fs">
            <legend className="mv-lbl" style={{ marginBottom: 6 }}>Tipo</legend>
            <div className="mv-radios">
              <label><input type="radio" name="direction" value="PAYABLE" defaultChecked /><span>Pago</span></label>
              <label><input type="radio" name="direction" value="RECEIVABLE" /><span>Cobro</span></label>
            </div>
          </fieldset>
          <label className="mv-lbl">Concepto<input className="mv-input" name="description" placeholder="Ej.: alquiler, sueldo" /></label>
          <label className="mv-lbl">Monto<input className="mv-input" name="amount" inputMode="decimal" placeholder="0,00" /></label>
          <label className="mv-lbl">Cuenta<select className="mv-input" name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
          <label className="mv-lbl">Cada cuánto<select className="mv-input" name="frequency" defaultValue="MONTHLY">{Object.entries(FREQ).filter(([k]) => k !== "CUSTOM").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="mv-lbl">Primera vez<input className="mv-input" name="startDate" type="date" defaultValue={isoDate(today)} /></label>
          <label className="mv-lbl">Categoría<select className="mv-input" name="categoryId" defaultValue=""><option value="">Sin categoría</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.kind === "INCOME" ? "ingreso" : "gasto"}</option>)}</select></label>
          <details className="mv-more" style={{ padding: 0 }}>
            <summary style={{ fontSize: 14 }}>Más opciones</summary>
            <div className="mv-fs">
              <label className="mv-lbl">Hasta (opcional)<input className="mv-input" name="endDate" type="date" /></label>
              <label className="mv-lbl">Día del mes (opcional)<input className="mv-input" name="dayOfMonth" inputMode="numeric" placeholder="Ej.: 10" /></label>
              <label className="mv-lbl">Si cae sábado o domingo<select className="mv-input" name="weekendRule" defaultValue="NONE"><option value="NONE">Dejar la fecha</option><option value="NEXT_BUSINESS_DAY">Pasar al lunes</option><option value="PREVIOUS_BUSINESS_DAY">Adelantar al viernes</option></select></label>
              <label className="mv-lbl">Aumento programado (%)<input className="mv-input" name="increasePct" inputMode="decimal" placeholder="Ej.: 6" /></label>
              <label className="mv-lbl">Cada cuántos meses<input className="mv-input" name="increaseEvery" inputMode="numeric" placeholder="Ej.: 3" /></label>
              <label className="mv-check"><input type="checkbox" name="variable" /><span><b>El monto cambia cada vez</b><br /><span>Por ejemplo, la luz o una cosecha.</span></span></label>
            </div>
          </details>
          <MvSubmit>Crear</MvSubmit>
        </MvForm>
      </details>

      {ended.length > 0 && (
        <details className="mv-card mv-more">
          <summary>Terminados ({ended.length})</summary>
          <div className="mv-card-list" style={{ margin: "0 -16px" }}>{ended.map((r) => row(r, false))}</div>
        </details>
      )}
    </main>
  );
}
