import Link from "next/link";
import { reviewUpcoming } from "@/lib/upcoming-review";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { isEstimatedGrain, loadSaleHref } from "@/server/grain";
import { getDb } from "@/lib/db";
import { openObligations, type OpenItem } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtDayMonth, fmtPeriod, period, periodEnd, todayIn } from "@/lib/dates";
import { PageHead, Tabs } from "@/components/page";
import { cancelObligationAction } from "@/app/actions/app";
import { projectedAction } from "@/app/actions/modules";
import { projectedItems } from "@/server/recurring";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ConfirmButton, SwipeRow } from "@/components/swipe-row";
import { Help } from "@/components/help";
import { ActionForm, Submit } from "@/components/forms";
import { bulkPayAction } from "@/app/actions/app";
import { SelectAll } from "../movimientos/select-all";

// Un proyectado es un pago que se repite más adelante: se calcula al vuelo y se crea recién al pagarlo o cancelarlo.
type Row = OpenItem & { proj?: { ruleId: string; occ: string; variable: boolean } };

export const metadata: Metadata = { title: "Próximos pagos y cobros" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function Upcoming({ searchParams }: { searchParams: Promise<{ ver?: string; guardado?: string; listo?: string; corregido?: string; borrado?: string; elegir?: string; meses?: string; orden?: string; q?: string; coincidencias?: string }> }) {
  const { workspace, modules, plan } = await requireWorkspace();
  const grainOn = !!modules.cereal && (await canUse(plan, "cereal"));
  const { ver, guardado, listo, corregido, borrado, elegir, meses, orden, q, coincidencias } = await searchParams;
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const in7 = new Date(today.getTime() + 7 * 864e5);
  const thisMonth = period(today);
  // Por defecto, este mes y los 2 que siguen (carga rápido); con "Ver 12 meses", el año entero.
  const all12 = meses === "12";
  const horizon = periodEnd(addMonths(thisMonth, all12 ? 12 : 2));
  const [all, projRaw, accounts] = await Promise.all([openObligations(getDb(), workspace.id, today, { until: horizon }), projectedItems(getDb(), workspace.id, today, horizon), getDb().account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, currency: true } })]);
  const proj: Row[] = projRaw.map((p) => ({
    id: `p-${p.ruleId}-${p.occurrence.toISOString().slice(0, 10)}`, direction: p.direction, description: p.description, currency: p.currency, dueDate: p.dueDate,
    economicPeriod: period(p.occurrence), amount: p.amount, remaining: p.amount, certainty: "PROBABLE", overdue: false, status: "PENDING", category: null,
    proj: { ruleId: p.ruleId, occ: p.occurrence.toISOString().slice(0, 10), variable: p.variable },
  }));
  const rows: Row[] = [...all, ...proj].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const alphabetical = orden === "nombre";
  const { shown, matches } = reviewUpcoming(rows, { q, alphabetical, matchesOnly: coincidencias === "1", direction: ver === "pagar" ? "PAYABLE" : ver === "cobrar" ? "RECEIVABLE" : undefined });
  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ver, meses, orden, q, coincidencias, ...changes })) if (value) params.set(key, value);
    return `/app/proximos${params.size ? `?${params}` : ""}`;
  };

  // Una sola lista por fecha: atrasado, esta semana, resto del mes y después, mes por mes.
  let groups: [string, Row[]][] = [
    ["Atrasado", shown.filter((o) => o.overdue)],
    ["Esta semana", shown.filter((o) => !o.overdue && o.dueDate <= in7)],
    ["Resto del mes", shown.filter((o) => o.dueDate > in7 && period(o.dueDate) === thisMonth)],
  ];
  const later = [...new Set(shown.filter((o) => o.dueDate > in7 && period(o.dueDate) !== thisMonth).map((o) => period(o.dueDate)))].sort();
  for (const p of later) groups.push([fmtPeriod(p), shown.filter((o) => o.dueDate > in7 && period(o.dueDate) === p)]);

  if (alphabetical) groups = [["Por nombre (A–Z)", shown]];

  const inBase = (l: OpenItem[]) => l.filter((o) => o.currency === cur);
  const total = (l: OpenItem[], dir: "PAYABLE" | "RECEIVABLE") => inBase(l).filter((o) => o.direction === dir).reduce((s, o) => s.plus(o.remaining), ZERO);
  const week = all.filter((o) => o.overdue || o.dueDate <= in7);
  const lateList = all.filter((o) => o.overdue && o.direction === "PAYABLE");
  const net = (l: OpenItem[]) => total(l, "RECEIVABLE").minus(total(l, "PAYABLE"));

  return (
    <>
      <PageHead crumb="Pagos y deudas" title="Próximos pagos y cobros" desc="Lo que falta pagar y cobrar en los próximos meses. Lo marcado como Proyectado sale de tus pagos que se repiten." actions={<Link className="btn pri" href="/app/movimientos/nuevo?estado=pendiente">+ Agregar un pago o cobro</Link>} />
      {(corregido || borrado) && <p className="notice g" role="status">{corregido ? "Listo, guardamos los cambios." : "Listo, lo eliminamos."}</p>}
      {listo && <p className="notice g" role="status">{listo === "cobro" ? "Listo, registramos el cobro." : "Listo, registramos el pago."}</p>}
      {guardado && <div className="notice g" role="status"><span>Listo, quedó guardado.</span><Link className="btn sm" href="/app/movimientos/nuevo?estado=pendiente" style={{ marginLeft: "auto" }}>+ Cargar otro</Link></div>}
      {proj.length > 0 && <div className="sub help-line"><span className="pill">Proyectado</span> = lo que esperás de tus pagos que se repiten <Help term="proyectado" /></div>}
      {modules.calendario && <Tabs current="lista" items={[{ key: "lista", label: "Lista", href: "/app/proximos" }, { key: "cal", label: "Calendario", href: "/app/calendario" }]} />}
      <div className="fc" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <div><small>Atrasado</small><b className={lateList.length ? "neg" : ""}>{formatMoney(total(lateList, "PAYABLE"), cur)}</b></div>
        <div><small>Esta semana salen</small><b>{formatMoney(total(week, "PAYABLE"), cur)}</b></div>
        <div><small>Esta semana entran</small><b className="pos">{formatMoney(total(week, "RECEIVABLE"), cur)}</b></div>
      </div>
      <div className="seg" style={{ alignSelf: "flex-start" }}>
        {[["", "Todo"], ["pagar", "A pagar"], ["cobrar", "A cobrar"]].map(([k, l]) => <Link key={k} className={`segl ${(ver ?? "") === k ? "on" : ""}`} href={href({ ver: k })}>{l}</Link>)}
      </div>
      <form method="get" className="card upcoming-filters" role="search">
        {ver && <input type="hidden" name="ver" value={ver} />}
        {meses && <input type="hidden" name="meses" value={meses} />}
        <label className="field">Buscar concepto<input type="search" name="q" defaultValue={q ?? ""} placeholder="Ej.: Bancor, alquiler…" maxLength={150} /></label>
        <label className="field">Ordenar por<select name="orden" defaultValue={alphabetical ? "nombre" : "fecha"}><option value="fecha">Fecha de vencimiento</option><option value="nombre">Nombre (A–Z)</option></select></label>
        <label className="field">Mostrar<select name="coincidencias" defaultValue={coincidencias === "1" ? "1" : ""}><option value="">Todos</option><option value="1">Solo posibles repetidos</option></select></label>
        <button className="btn" type="submit">Aplicar</button>
        <Link className="btn ghost" href={href({ q: undefined, orden: undefined, coincidencias: undefined })}>Limpiar</Link>
      </form>
      {matches.size > 0 && <p className="sub" role="status">Hay {matches.size} registros con el mismo concepto, fecha, importe original y moneda. Revisalos antes de cancelar: pueden ser operaciones distintas. Los pagos de meses diferentes no se consideran coincidencias.</p>}
      <div className="acts" style={{ justifyContent: "flex-end", marginBottom: -6 }}>
        {elegir ? <Link className="btn sm" href={href({})}>Listo</Link> : coincidencias !== "1" && all.length > 1 && <Link className="btn sm" href={href({ elegir: "1" })}>Pagar varios juntos</Link>}
      </div>
      {elegir ? (() => {
        // Lo atrasado y lo de este mes (sin proyectados ni ventas de cereal estimadas): se paga lo que falta de cada uno.
        const visibleIds = new Set(shown.map((o) => o.id));
        const cand = all.filter((o) => visibleIds.has(o.id) && (o.overdue || period(o.dueDate) === thisMonth) && !(grainOn && isEstimatedGrain(o)) && (ver === "cobrar" ? o.direction === "RECEIVABLE" : ver === "pagar" ? o.direction === "PAYABLE" : true));
        return (
          <ActionForm action={bulkPayAction} id="bulkpay" className="card bulk-bar" style={{ position: "static" }}>
            <div className="bulk-top"><b>Elegí los que ya pagaste o cobraste</b><SelectAll form="bulkpay" /></div>
            {cand.length ? <div className="list">{cand.map((o) => (
              <label className="li sel-row" key={o.id}>
                <input type="checkbox" name="ids" value={o.id} form="bulkpay" aria-label={`Elegir ${o.description}`} />
                <div className="grow"><div className="t">{o.description} {matches.has(o.id) && <span className="pill a">Revisar coincidencia</span>}</div><div className="s">{o.direction === "RECEIVABLE" ? "A cobrar" : "A pagar"} · {o.overdue ? <span className="neg">venció el {fmtDayMonth(o.dueDate)}</span> : `vence el ${fmtDayMonth(o.dueDate)}`}</div></div>
                <b className={`num ${o.direction === "RECEIVABLE" ? "pos" : "neg"}`}>{o.direction === "RECEIVABLE" ? "+" : "−"}{formatMoney(o.remaining, o.currency)}</b>
              </label>
            ))}</div> : <div className="empty">No hay nada atrasado ni de este mes.</div>}
            <div className="bulk-acts">
              <select name="accountId" aria-label="Cuenta" defaultValue={accounts[0]?.id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select>
              <input type="date" name="date" aria-label="Fecha" defaultValue={today.toISOString().slice(0, 10)} style={{ minHeight: 40, border: "1px solid var(--line-2)", borderRadius: 8, padding: "0 10px", background: "var(--surface)", color: "var(--fg)" }} />
              <Submit>Registrar los elegidos</Submit>
            </div>
            <p className="sub" style={{ margin: 0 }}>Se registra lo que falta de cada uno, desde esa cuenta. Los resúmenes de tarjeta se pagan completos; si pagaste otro monto, hacelo de a uno.</p>
          </ActionForm>
        );
      })() : shown.length === 0 ? (
        <div className="empty">
          <p style={{ margin: "0 0 12px" }}>{q || coincidencias === "1" ? "No hay resultados para estos filtros." : ver === "cobrar" ? "No tenés nada por cobrar." : ver === "pagar" ? "No tenés nada por pagar." : "No tenés nada por pagar ni por cobrar."}</p>
          <Link className="btn" href="/app/movimientos/nuevo?estado=pendiente">+ Agregar un pago o cobro</Link>
        </div>
      ) : groups.filter(([, l]) => l.length).map(([title, list]) => {
        const n = net(list);
        return (
          // Lo urgente queda abierto; cada mes que viene se despliega al tocarlo.
          <details className="card grp" key={title} open={alphabetical || ["Atrasado", "Esta semana", "Resto del mes"].includes(title)}>
            <summary className="chead grp-sum"><span className="grp-t"><h3>{title}</h3><small>{list.length} {list.length === 1 ? "pago o cobro" : "pagos y cobros"}</small></span><span className={`num ${n.isNegative() ? "neg" : "pos"}`}>{formatMoney(n, cur, { sign: true })}</span><span className="grp-chev" aria-hidden="true">›</span></summary>
            <div className="list">{list.map((o) => {
              const rec = o.direction === "RECEIVABLE";
              if (o.proj) return (
                <div className="li proj" key={o.id}>
                  <div className="dchip"><b>{o.dueDate.getUTCDate()}</b><span>{MES[o.dueDate.getUTCMonth()]}</span></div>
                  <div className="grow">
                    <div className="t">{o.description} {matches.has(o.id) && <span className="pill a">Revisar coincidencia</span>}</div>
                    <div className="s"><span className="pill">Proyectado</span> {rec ? "A cobrar" : "A pagar"} · se repite{o.proj.variable ? " · monto aproximado" : ""}</div>
                  </div>
                  <b className={`num ${rec ? "pos" : "neg"}`}>{rec ? "+" : "−"}{formatMoney(o.remaining, o.currency)}</b>
                  <div className="li-acts">
                    <form action={projectedAction}><input type="hidden" name="ruleId" value={o.proj.ruleId} /><input type="hidden" name="occurrence" value={o.proj.occ} /><input type="hidden" name="do" value="pagar" /><button className="btn sm" type="submit">{rec ? "Cobrar" : "Pagar"}</button></form>
                    <form action={projectedAction}><input type="hidden" name="ruleId" value={o.proj.ruleId} /><input type="hidden" name="occurrence" value={o.proj.occ} /><input type="hidden" name="do" value="cancelar" /><input type="hidden" name="back" value={href({})} /><ConfirmSubmit className={coincidencias === "1" ? "btn sm" : "dots"} title="Cancelar solo esta vez" ariaLabel={`Cancelar ${o.description} solo esta vez`} question={`¿Cancelar ${o.description} del ${o.dueDate.getUTCDate()} de ${MES[o.dueDate.getUTCMonth()]}?`} yes="Sí, cancelar">{coincidencias === "1" ? "Cancelar" : "×"}</ConfirmSubmit></form>
                  </div>
                </div>
              );
              const payHref = grainOn && isEstimatedGrain(o) ? loadSaleHref(o.dueDate) : `/app/proximos/${o.id}`;
              const cancelQ = `¿Cancelar ${o.description} (${formatMoney(o.remaining, o.currency)})?`;
              return (
                <SwipeRow key={o.id} actions={<>
                  <Link className="sw-pay" href={payHref}>{grainOn && isEstimatedGrain(o) ? "Cargar" : rec ? "Cobrar" : "Pagar"}</Link>
                  <form action={cancelObligationAction}><input type="hidden" name="id" value={o.id} /><ConfirmButton question={cancelQ}>Cancelar</ConfirmButton></form>
                </>}>
                  <div className="dchip"><b className={o.overdue ? "neg" : ""}>{o.dueDate.getUTCDate()}</b><span className={o.overdue ? "neg" : ""}>{MES[o.dueDate.getUTCMonth()]}</span></div>
                  <div className="grow">
                    <div className="t">{o.source === "card" || o.source === "grain" ? o.description : <Link className="tlink" href={`/app/proximos/${o.id}?corregir=1#corregir`} title="Corregir">{o.description}</Link>} {matches.has(o.id) && <span className="pill a">Revisar coincidencia</span>}</div>
                    <div className="s">
                      {rec ? "A cobrar" : "A pagar"}
                      {o.overdue ? ` · venció el ${fmtDayMonth(o.dueDate)}` : ""}
                      {o.status === "PARTIAL" ? ` · ${rec ? "cobrado" : "pagado"} en parte, total ${formatMoney(o.amount, o.currency)}` : ""}
                      {o.category ? ` · ${o.category}` : ""}
                      {o.recurringRuleId ? " · se repite" : ""}
                    </div>
                  </div>
                  <b className={`num ${rec ? "pos" : "neg"}`}>{rec ? "+" : "−"}{formatMoney(o.remaining, o.currency)}</b>
                  <div className="li-acts">{grainOn && isEstimatedGrain(o) ? <Link className="btn sm" href={loadSaleHref(o.dueDate)}>Cargar venta</Link> : <Link className="btn sm" href={`/app/proximos/${o.id}`}>{rec ? "Cobrar" : "Pagar"}</Link>}
                  <form action={cancelObligationAction}><input type="hidden" name="id" value={o.id} /><ConfirmSubmit className={coincidencias === "1" ? "btn sm" : "dots"} title="Cancelar: ya no se va a pagar ni cobrar" ariaLabel={`Cancelar ${o.description}`} question={cancelQ} yes="Sí, cancelar">{coincidencias === "1" ? "Cancelar" : "×"}</ConfirmSubmit></form></div>
                </SwipeRow>
              );
            })}</div>
          </details>
        );
      })}
      {!elegir && shown.length > 0 && (
        <div className="acts" style={{ justifyContent: "center" }}>
          {all12 ? <Link className="btn sm" href={href({ meses: undefined })}>Ver solo los próximos 3 meses</Link> : <Link className="btn sm" href={href({ meses: "12" })}>Ver los próximos 12 meses</Link>}
        </div>
      )}
    </>
  );
}
