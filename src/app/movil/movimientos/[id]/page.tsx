import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate } from "@/lib/dates";
import { deleteMovementAction, updateMovementAction } from "@/app/actions/app";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MvForm, MvSubmit } from "../../form-ui";

export const metadata: Metadata = { title: "Movimiento" };

// Detalle de un movimiento: corregirlo o eliminarlo. Mismas reglas que en la web.
export default async function MovimientoMovil({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const { error } = await searchParams;
  const db = getDb();
  const t = await db.transaction.findFirst({ where: { id, workspaceId: workspace.id }, include: { account: true, category: true, reversedBy: true, reversalOf: true, obligation: true } });
  if (!t) notFound();
  const kind = t.type === "INCOME" ? "INCOME" : "EXPENSE";
  const [cats, plan, legs, accounts] = await Promise.all([
    db.category.findMany({ where: { workspaceId: workspace.id, archived: false, kind }, orderBy: [{ parentId: "asc" }, { name: "asc" }] }),
    db.installmentPlan.findFirst({ where: { transactionId: t.id } }),
    t.transferGroupId ? db.transaction.findMany({ where: { workspaceId: workspace.id, transferGroupId: t.transferGroupId, id: { not: t.id } }, include: { account: { select: { name: true } } } }) : Promise.resolve([]),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, currency: t.currency, type: { not: "CREDIT_CARD" } }, select: { id: true, name: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  const parents = cats.filter((c) => !c.parentId);
  const options = parents.flatMap((p) => [{ id: p.id, label: p.name }, ...cats.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, label: `${p.name} › ${c.name}` }))]);
  const reversed = !!(t.reversedBy || t.reversalOfId);
  const grain = t.obligation?.sourceType === "grain";
  const fixedAmount = !!plan || grain || t.type === "DEBT_DISBURSEMENT" || t.type === "INVESTMENT";
  const canMove = (t.type === "INCOME" || t.type === "EXPENSE") && !t.obligationId && !t.transferGroupId && !plan && t.account.type !== "CREDIT_CARD";
  const isIn = t.direction === "IN";
  const transfer = t.type === "TRANSFER";
  const amountText = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(t.amount));
  const goneWith = [
    transfer ? "las dos partes de la transferencia" : null,
    plan ? "las cuotas que faltan de esta compra" : null,
    t.obligation ? (!t.obligation.recurringRuleId && !t.obligation.sourceType && Math.abs(t.obligation.createdAt.getTime() - t.createdAt.getTime()) < 10_000 ? "lo que quedaba pendiente de él" : `el pago de “${t.obligation.description}”, que vuelve a quedar pendiente`) : null,
  ].filter(Boolean);
  const question = `¿Eliminar “${t.description}”? Se borra del todo${goneWith.length ? `, junto con ${goneWith.join(" y ")}` : ""}, y el saldo de la cuenta vuelve a como estaba. No se puede deshacer.`;

  return (
    <main className="mv-main">
      <header className="mv-head" style={{ justifyContent: "flex-start", gap: 12 }}>
        <Link className="mv-ibtn" href="/movil/movimientos" aria-label="Volver a Movimientos"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></Link>
        <h1 className="mv-hello" style={{ fontSize: 20 }}>Movimiento</h1>
      </header>
      {error && <p className="mv-error" role="alert">{error}</p>}

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{t.description}</div>
        <div className={`mv-num mv-amt ${transfer ? "" : isIn ? "pos" : ""}`} style={{ fontSize: 34 }}>{transfer ? "" : isIn ? "+ " : "− "}{formatMoney(t.amount, t.currency)}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{fmtDate(t.effectiveDate)} · {t.account.name}{transfer && legs[0] ? ` → ${legs[0].account.name}` : ""}</div>
        {t.obligation && <div style={{ fontSize: 13, color: "var(--muted)" }}>Es un pago de “{t.obligation.description}”.</div>}
        {plan && <div style={{ fontSize: 13, color: "var(--muted)" }}>Compra en {plan.installments} cuotas con tarjeta.</div>}
        {reversed && <div style={{ fontSize: 13, color: "var(--muted)" }}>{t.reversedBy ? "Este movimiento estaba anulado." : `Anulaba a “${t.reversalOf?.description}”.`} Si ya no lo necesitas, elimínalo: se borran los dos.</div>}
      </section>

      {!reversed && (
        <section className="mv-sec">
          <h2 className="mv-h2">Corregir</h2>
          <MvForm action={updateMovementAction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="back" value="/movil" />
            <label className="mv-lbl">Concepto<input className="mv-input" name="description" defaultValue={t.description} maxLength={140} /></label>
            <label className="mv-lbl">Monto{fixedAmount ? <input className="mv-input" disabled value={formatMoney(t.amount, t.currency)} /> : <input className="mv-input" name="amount" inputMode="decimal" defaultValue={amountText} />}</label>
            {!transfer && <label className="mv-lbl">Categoría<select className="mv-input" name="categoryId" defaultValue={t.categoryId ?? ""}><option value="">Sin categoría</option>{options.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
            {!transfer && canMove && accounts.length > 1 && <label className="mv-lbl">{isIn ? "Entró en" : "Salió de"}<select className="mv-input" name="accountId" defaultValue={t.accountId}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
            <label className="mv-lbl">Fecha<input className="mv-input" name="effectiveDate" type="date" defaultValue={isoDate(t.effectiveDate)} /></label>
            <input type="hidden" name="economicPeriod" value={t.economicPeriod} />
            <label className="mv-lbl">Nota<input className="mv-input" name="notes" defaultValue={t.notes ?? ""} placeholder="Opcional" /></label>
            {fixedAmount && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{grain ? "El monto de una venta de cereal se corrige desde Ventas de cereal." : plan ? "El monto de una compra en cuotas no se cambia acá: si está mal, elimínala y cárgala de nuevo." : "Este monto se corrige desde su propia pantalla."}</p>}
            <MvSubmit>Guardar cambios</MvSubmit>
          </MvForm>
        </section>
      )}

      <form action={deleteMovementAction} className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="back" value="/movil/movimientos?borrado=1" />
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>¿Lo cargaste por error? Elimínalo: se borra del todo y el saldo vuelve a como estaba.</p>
        <ConfirmSubmit className="mv-btn mv-danger" question={question} yes="Sí, eliminar">Eliminar movimiento</ConfirmSubmit>
      </form>
    </main>
  );
}
