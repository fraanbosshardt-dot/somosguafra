import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { calendar, cardGroups, statementAmount } from "@/server/cards";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, isoDate, period, todayIn } from "@/lib/dates";
import { ActionForm, Submit } from "@/components/forms";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { addSubscriptionAction, advancePlanAction, cardPurchaseAction, cardRefundAction, deleteCardAction, endSubscriptionAction, setCycleAction, updateCardAction } from "@/app/actions/modules";
import { CardFields } from "@/app/app/tarjetas/card-fields";
import { StatementForm } from "@/app/app/tarjetas/[id]/statement-form";
import { MvBackHead } from "../../../head";
import { MvIcon, Toast, type MvIconName } from "../../../ui";

export const metadata: Metadata = { title: "Tarjeta" };

const PANELS: Record<string, string> = {
  resumen: "Cargar un resumen", compra: "Registrar una compra", devolucion: "Devolución o reintegro", suscripciones: "Suscripciones",
  cuotas: "Compras en cuotas", gastos: "En qué se fue el resumen", compras: "Últimas compras", resumenes: "Resúmenes anteriores",
  fechas: "Fechas de este mes", editar: "Editar tarjeta",
};
const SIMPLE_OPTS = ["resumenes", "fechas", "editar"];
const OPTIONS: [string, MvIconName, string][] = [
  ["suscripciones", "repeat", "Netflix, gimnasio: se cargan solas"],
  ["cuotas", "cal", "Ver o adelantar"],
  ["devolucion", "up", "Lo que te devolvieron"],
  ["gastos", "pie", "Por categoría y por persona"],
  ["compras", "list", "Las últimas que cargaste"],
  ["resumenes", "file", "Los que ya cerraron"],
  ["fechas", "cal", "Si este mes cierra en otra fecha"],
  ["editar", "gear", "Datos, límite y más"],
];
const NOTICE: Record<string, string> = {
  editada: "Listo, guardamos los cambios de la tarjeta.", fechas: "Listo, este mes cierra y vence en las fechas nuevas.",
  devolucion: "Listo, la devolución baja el próximo resumen.", adelantada: "Listo, las cuotas que faltaban entran en el próximo resumen.",
  suscripcion: "Listo, la suscripción se carga sola cada mes.", guardado: "Listo, quedó guardado.",
};

export default async function TarjetaMovil({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace, plan } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const groups = await cardGroups(db, workspace.id, today);
  const g = groups.find((x) => x.card.id === id);
  if (!g) {
    const child = await db.creditCard.findFirst({ where: { id, workspaceId: workspace.id }, select: { parentId: true } });
    if (child?.parentId) redirect(`/movil/explorar/tarjetas/${child.parentId}`);
    notFound();
  }
  const card = g.card, ch = g.child;
  const parts = [g, ...(ch ? [ch] : [])];
  const accIds = parts.map((p) => p.card.accountId!).filter(Boolean);
  const [cats, recent, accounts] = await Promise.all([
    db.category.findMany({ where: { workspaceId: workspace.id, kind: "EXPENSE", parentId: null }, orderBy: { name: "asc" } }),
    db.transaction.findMany({ where: { workspaceId: workspace.id, accountId: { in: accIds }, type: "EXPENSE" }, orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }], take: 25, include: { category: true } }),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  const pdf = await canUse(plan, "pdf");
  const pdfUsed = pdf ? await db.auditLog.count({ where: { workspaceId: workspace.id, action: "card.pdf_read", createdAt: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) } } }) : 0;
  const pdfLeft = Math.max(0, (await (await import("@/server/settings")).pdfMonthlyLimit(getDb())) - pdfUsed);
  const cal = calendar(card);
  const lastClose = (() => { const x = cal.closingFor(today); return x > today ? cal.prev(x) : x; })();
  const fm = (v: Parameters<typeof formatMoney>[0], cur = card.currency) => formatMoney(v, cur);
  const curOf = new Map(parts.map((p) => [p.card.accountId, p.card.currency]));
  const holders = card.holders;
  const currencies = parts.map((p) => p.card.currency);
  const plans = parts.flatMap((p) => p.activePlans.map((x) => ({ ...x, currency: p.card.currency })));
  const subs = parts.flatMap((p) => p.subscriptions.map((x) => ({ ...x, currency: p.card.currency })));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const simple = card.mode === "SIMPLE";
  const lastLoaded = card.statements.find((x) => x.closingDate.getTime() === lastClose.getTime());
  const estimate = simple ? null : lastLoaded ? Number(lastLoaded.totalAmount) : (await statementAmount(db, card, lastClose)).total.toNumber();
  const sel = sp.ver ?? (!card.statements.length && !g.status.open.length ? "resumen" : "");
  const base = `/movil/explorar/tarjetas/${card.id}`;
  const pickCurrency = currencies.length > 1 && <label className="field">Moneda<select name="currency" defaultValue={card.currency}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></label>;
  const pickHolder = holders.length > 0 && <label className="field">¿Quién la hizo?<select name="holder" defaultValue=""><option value="">Titular</option>{holders.map((h) => <option key={h}>{h}</option>)}</select></label>;
  const back = <input type="hidden" name="back" value="/movil" />;
  const catSelect = <label className="field">Categoría<select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>;
  const spent = (rows: { name: string; amount: typeof ZERO }[], cur: string) => {
    const tot = rows.reduce((s, r) => s.plus(r.amount), ZERO);
    return rows.length ? (
      <div className="mv-card-list" style={{ margin: "0 -16px" }}>{rows.map((r) => (
        <div className="mv-row" key={r.name} style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span className="t">{r.name}</span><b className="mv-num mv-amt">{formatMoney(r.amount, cur)}</b></div>
          <span style={{ height: 6, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${tot.gt(0) ? Math.max(2, r.amount.dividedBy(tot).times(100).toNumber()) : 0}%`, background: "var(--brand)" }} /></span>
        </div>
      ))}</div>
    ) : <div className="mv-empty">Todavía no hay compras en este resumen.</div>;
  };

  return (
    <main className="mv-main">
      {Object.entries(NOTICE).map(([k, t]) => sp[k] && <Toast key={k} text={t} />)}
      <MvBackHead href="/movil/explorar/tarjetas" sub={card.issuer || "Tarjeta"} title={card.name} />
      {g.overAlert && <p className="mv-error" role="status">Estás usando el {g.usagePct} % del límite (tu aviso es {card.alertPct} %).</p>}

      <div className="mv-cc big">
        <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>{card.issuer}</span>
        <span style={{ fontSize: 18, letterSpacing: ".14em" }}>•••• •••• •••• {card.last4 ?? "····"}</span>
        <span style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>{card.name}</span><span>Cierra el {fmtDate(g.nextClosing)}</span></span>
      </div>

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {parts.every((p) => !p.status.open.length) ? (
          <div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>No tienes resúmenes sin pagar</div><b className="pos" style={{ fontSize: 26 }}>Al día</b></div>
        ) : parts.filter((p) => p.status.open.length).map((p) => {
          const toPay = p.status.open[0];
          return (
            <div key={p.card.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: p.status.overdue ? "var(--neg)" : "var(--muted)" }}>{p.status.overdue ? `Atrasado · venció el ${fmtDate(toPay.dueDate)}` : `A pagar · vence el ${fmtDate(toPay.dueDate)}`}</div>
              <b className={`mv-num mv-amt ${p.status.overdue ? "neg" : ""}`} style={{ fontSize: 30 }}>{fm(p.status.owed, p.card.currency)}</b>
              {toPay.partial && <span style={{ fontSize: 13, color: "var(--muted)" }}>Pagaste una parte: lo que falta pasa al próximo resumen.</span>}
              <Link className="mv-btn pri" href={`/movil/proximos/${toPay.id}`} style={{ flex: "none" }}>Pagar{ch ? ` en ${p.card.currency}` : ""}</Link>
            </div>
          );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 12px", fontSize: 13, fontWeight: 600, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <span>Próximo resumen{g.nextIsGuess ? " (estimado)" : ""}<br /><small>Cierra {fmtDate(g.nextClosing)} · vence {fmtDate(g.nextDue)}</small></span><b className="mv-amt" style={{ color: "var(--ink)" }}>{parts.map((p) => fm(p.nextAmount, p.card.currency)).join(" + ")}</b>
          {simple
            ? g.lastStatement && <><span>Último resumen</span><b className="mv-amt" style={{ color: "var(--ink)" }}>{parts.map((p) => (p.lastStatement ? fm(p.lastStatement.totalAmount, p.card.currency) : "—")).join(" + ")}</b></>
            : <><span>Debes en total</span><b className="mv-amt" style={{ color: "var(--ink)" }}>{parts.map((p) => fm(p.debt, p.card.currency)).join(" + ")}</b>
              <span>Cuotas que faltan</span><b className="mv-amt" style={{ color: "var(--ink)" }}>{parts.map((p) => fm(p.futureInstallments, p.card.currency)).join(" + ")}</b></>}
        </div>
        {g.usagePct != null && (
          <div>
            <span style={{ display: "block", height: 8, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }}><i className="mv-grow-x" style={{ display: "block", height: "100%", width: `${Math.min(100, g.usagePct)}%`, background: g.overAlert ? "var(--neg)" : "var(--brand)" }} /></span>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginTop: 6 }}><span>Usas el {g.usagePct} %</span><span className="mv-amt">Disponible {fm(g.available)}</span></div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Link className={`mv-btn ${sel === "resumen" || simple ? "pri" : ""}`} href={`${base}?ver=resumen#panel`} style={{ borderColor: "var(--field-line)" }}>Cargar resumen</Link>
          {!simple && <Link className={`mv-btn ${sel === "compra" ? "pri" : ""}`} href={`${base}?ver=compra#panel`} style={{ borderColor: "var(--field-line)" }}>+ Compra</Link>}
        </div>
      </section>

      {sel && PANELS[sel] && (
        <section className="mv-card" id="panel" style={{ display: "flex", flexDirection: "column", gap: 12, scrollMarginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 className="mv-h2" style={{ fontSize: 17 }}>{PANELS[sel]}</h2><Link className="mv-link" href={base} style={{ minHeight: 0 }}>Cerrar</Link></div>
          {sel === "resumen" && <div className="mv-web"><StatementForm back="/movil" cardId={card.id} currency={card.currency} simple={simple} closingDay={card.closingDay} estimate={estimate} loadedClosings={card.statements.filter((x) => x.loaded).map((x) => isoDate(x.closingDate))} second={ch ? { cardId: ch.card.id, currency: ch.card.currency } : null} closing={isoDate(lastClose)} due={isoDate(cal.due(lastClose))} pdf={pdf} pdfLeft={pdfLeft} /></div>}
          {sel === "compra" && <ActionForm action={cardPurchaseAction} className="mv-web">
            {back}<input type="hidden" name="cardId" value={card.id} />
            <label className="field">¿Qué compraste?<input name="description" placeholder="Ej.: supermercado" /></label>
            <label className="field">Precio<input name="amount" inputMode="decimal" placeholder="0,00" /></label>
            <label className="field">Cuotas<select name="installments" defaultValue="1">{[1, 2, 3, 4, 5, 6, 9, 10, 12, 18, 24].map((n) => <option key={n} value={n}>{n === 1 ? "En un pago" : `${n} cuotas`}</option>)}</select></label>
            <label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label>
            {catSelect}{pickCurrency}{pickHolder}
            <details className="more"><summary>Con interés</summary>
              <div className="mv-web" style={{ paddingTop: 8 }}><label className="field">Interés<select name="interest" defaultValue="sin"><option value="sin">Sin interés</option><option value="con">Con interés</option></select></label><label className="field">Total financiado<input name="financedTotal" inputMode="decimal" placeholder="0,00" /></label></div>
            </details>
            <p className="sub" style={{ margin: 0 }}>El gasto se registra una vez por el total; cada mes entra la cuota en el resumen.</p>
            <div><Submit>Guardar compra</Submit></div>
          </ActionForm>}
          {sel === "devolucion" && <ActionForm action={cardRefundAction} className="mv-web">
            {back}<input type="hidden" name="cardId" value={card.id} />
            <label className="field">¿Qué te devolvieron?<input name="description" placeholder="Ej.: reintegro supermercado" /></label>
            <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" /></label>
            <label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label>
            {catSelect}{pickCurrency}{pickHolder}
            <p className="sub" style={{ margin: 0 }}>Baja el resumen y descuenta el gasto de esa categoría.</p>
            <div><Submit>Guardar devolución</Submit></div>
          </ActionForm>}
          {sel === "suscripciones" && <>
            {subs.length > 0 && <div className="mv-card-list" style={{ margin: "0 -16px" }}>{subs.map((s) => (
              <div className="mv-row" key={s.id}>
                <span className="grow"><span className="t" style={{ display: "block" }}>{s.description}</span><span className="s">Todos los {s.dayOfMonth} · {(s.categoryId && catName.get(s.categoryId)) || "Sin categoría"}{s.holder ? ` · ${s.holder}` : ""}</span></span>
                <b className="v mv-num mv-amt">{fm(s.amount, s.currency)}</b>
                <form action={endSubscriptionAction}>{back}<input type="hidden" name="id" value={s.id} /><input type="hidden" name="cardId" value={card.id} /><ConfirmSubmit className="mv-ibtn" ariaLabel={`Dar de baja ${s.description}`} question={`¿Dar de baja ${s.description}? Deja de cargarse desde hoy.`} yes="Sí, dar de baja">×</ConfirmSubmit></form>
              </div>
            ))}</div>}
            <ActionForm action={addSubscriptionAction} className="mv-web">
              {back}<input type="hidden" name="cardId" value={card.id} />
              <label className="field">¿Qué es?<input name="description" placeholder="Ej.: Netflix, gimnasio" /></label>
              <label className="field">Monto por mes<input name="amount" inputMode="decimal" placeholder="0,00" /></label>
              <label className="field">Día que se cobra<input name="dayOfMonth" inputMode="numeric" placeholder="1 a 31" /></label>
              {catSelect}{pickCurrency}{pickHolder}
              <div><Submit>Agregar suscripción</Submit></div>
            </ActionForm>
          </>}
          {sel === "cuotas" && (plans.length ? <div className="mv-card-list" style={{ margin: "0 -16px" }}>{plans.map((p) => (
            <div className="mv-row" key={p.id} style={{ alignItems: "flex-start" }}>
              <span className="grow" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {p.transactionId ? <Link className="t" href={`/movil/movimientos/${p.transactionId}`}>{p.description}</Link> : <span className="t">{p.description}</span>}
                <span className="s">{p.paid} de {p.installments} cuotas · {p.interestFree ? "sin interés" : "con interés"} · faltan <span className="mv-amt">{fm(p.left, p.currency)}</span></span>
                <span style={{ height: 6, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: `${(p.paid / p.installments) * 100}%`, background: "var(--brand)" }} /></span>
              </span>
              <span style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <b className="mv-num mv-amt">{fm(p.perMonth, p.currency)}</b>
                <form action={advancePlanAction}>{back}<input type="hidden" name="planId" value={p.id} /><input type="hidden" name="cardId" value={card.id} /><ConfirmSubmit className="mv-btn" question={`¿Adelantar las cuotas de ${p.description}? Entran todas (${fm(p.left, p.currency)}) en el próximo resumen.`} yes="Sí, adelantar">Adelantar</ConfirmSubmit></form>
              </span>
            </div>
          ))}</div> : <div className="mv-empty">No tienes compras en cuotas.</div>)}
          {sel === "gastos" && <>
            {parts.map((p) => (
              <div key={p.card.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <b style={{ fontSize: 14 }}>Resumen que cierra el {fmtDate(p.nextClosing)}{ch ? ` (${p.card.currency})` : ""}</b>{spent(p.spentNow.byCategory, p.card.currency)}
                <b style={{ fontSize: 14 }}>Resumen anterior ({fmtDate(p.lastClosed)})</b>{spent(p.spentLast.byCategory, p.card.currency)}
              </div>
            ))}
            {holders.length > 0 && <><b style={{ fontSize: 14 }}>Por persona</b>{spent(g.spentNow.byHolder, card.currency)}</>}
          </>}
          {sel === "compras" && (recent.length ? <div className="mv-card-list" style={{ margin: "0 -16px" }}>{recent.map((t) => (
            <Link className="mv-row" key={t.id} href={`/movil/movimientos/${t.id}`}>
              <span className="grow"><span className="t" style={{ display: "block" }}>{t.description}</span><span className="s">{fmtDate(t.effectiveDate)} · {t.category?.name ?? "Sin categoría"} · {period(t.effectiveDate)}{t.cardHolder ? ` · ${t.cardHolder}` : ""}{t.direction === "IN" ? " · devolución" : ""}</span></span>
              <b className={`v mv-num mv-amt ${t.direction === "IN" ? "pos" : ""}`}>{t.direction === "IN" ? "+ " : ""}{fm(t.amount, curOf.get(t.accountId) ?? card.currency)}</b>
            </Link>
          ))}</div> : <div className="mv-empty">Todavía no hay compras.</div>)}
          {sel === "resumenes" && (parts.some((p) => p.card.statements.length) ? <div className="mv-card-list" style={{ margin: "0 -16px" }}>{parts.flatMap((p) => p.card.statements.map((s) => ({ s, p }))).sort((a, b) => b.s.closingDate.getTime() - a.s.closingDate.getTime()).map(({ s, p }) => (
            <div className="mv-row" key={s.id}>
              <span className="grow"><span className="t" style={{ display: "block" }}>Cierre {fmtDate(s.closingDate)}{ch ? ` · ${p.card.currency}` : ""}</span><span className="s">Vence {fmtDate(s.dueDate)} · mínimo {fm(s.minimumAmount, p.card.currency)}{!s.obligationId ? "" : p.status.open.some((o) => o.id === s.obligationId) ? " · sin pagar" : " · pagado"}</span></span>
              <b className="v mv-num mv-amt">{fm(s.totalAmount, p.card.currency)}</b>
            </div>
          ))}</div> : <div className="mv-empty">Todavía no cerró ningún resumen.</div>)}
          {sel === "fechas" && <ActionForm action={setCycleAction} className="mv-web">
            {back}<input type="hidden" name="cardId" value={card.id} /><input type="hidden" name="usualClosing" value={isoDate(g.nextUsual.closing)} />
            <label className="field">Cierra el<input name="closingDate" type="date" defaultValue={isoDate(g.nextClosing)} /></label>
            <label className="field">Vence el<input name="dueDate" type="date" defaultValue={isoDate(g.nextDue)} /></label>
            <p className="sub" style={{ margin: 0 }}>Solo para el resumen que cierra cerca del {fmtDate(g.nextUsual.closing)}. Los demás meses siguen con el {card.closingDay} y el {card.dueDay}.</p>
            <div><Submit>Guardar fechas</Submit></div>
          </ActionForm>}
          {sel === "editar" && <>
            <ActionForm action={updateCardAction} className="mv-web">
              {back}<input type="hidden" name="cardId" value={card.id} />
              <CardFields edit accounts={accounts} base={workspace.baseCurrency} d={{ name: card.name, issuer: card.issuer, last4: card.last4 ?? "", limit: Number(card.limitAmount).toString().replace(".", ","), closingDay: String(card.closingDay), dueDay: String(card.dueDay), currency: card.currency, payAccountId: card.payAccountId ?? undefined, currency2: ch?.card.currency ?? null, mode: card.mode, financeRate: card.financeRate ? Number(card.financeRate).toString().replace(".", ",") : "", monthlyFee: card.monthlyFee ? Number(card.monthlyFee).toString().replace(".", ",") : "", alertPct: card.alertPct ? String(card.alertPct) : "", holders: holders.join(", ") }} />
              <label className="field">Estado<select name="active" defaultValue={card.active ? "on" : "off"}><option value="on">Activa</option><option value="off">Dada de baja (deja de sumar resúmenes)</option></select></label>
              <div><Submit>Guardar cambios</Submit></div>
            </ActionForm>
            <form action={deleteCardAction} className="mv-fs mv-del">
              {back}<input type="hidden" name="cardId" value={card.id} />
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>¿La cargaste por error? Elimínala: se borran sus compras, cuotas, resúmenes y pagos. Si solo ya no la usas, mejor dala de baja.</p>
              <ConfirmSubmit className="mv-btn mv-danger" question={`¿Eliminar ${card.name}? Se borran sus compras, cuotas, resúmenes y pagos (el saldo de tus cuentas vuelve a como estaba). No se puede deshacer.`} yes="Sí, eliminar">Eliminar tarjeta</ConfirmSubmit>
            </form>
          </>}
        </section>
      )}

      <section className="mv-sec" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Más opciones</h2>
        <div className="mv-card-list">
          {OPTIONS.filter(([k]) => !simple || SIMPLE_OPTS.includes(k)).map(([k, icon, sub]) => (
            <Link key={k} className="mv-row" href={`${base}?ver=${k}#panel`} aria-current={sel === k ? "true" : undefined}>
              <span className="mv-date"><MvIcon name={icon} /></span>
              <span className="grow"><span className="t" style={{ display: "block" }}>{PANELS[k]}{k === "suscripciones" && subs.length ? ` (${subs.length})` : k === "cuotas" && plans.length ? ` (${plans.length})` : ""}</span><span className="s">{sub}</span></span>
              <MvIcon name="chev" />
            </Link>
          ))}
        </div>
        {simple && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>¿Quieres ver en qué se fue el dinero, por categoría? Pásala a “cada compra” en Editar tarjeta.</p>}
      </section>
    </main>
  );
}
