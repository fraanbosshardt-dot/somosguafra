import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { openObligations, type OpenItem } from "@/server/ledger";
import { projectedItems } from "@/server/recurring";
import { formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtPeriod, period, periodEnd, todayIn } from "@/lib/dates";
import { cancelObligationAction } from "@/app/actions/app";
import { projectedAction } from "@/app/actions/modules";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CountUp, Toast } from "../ui";

export const metadata: Metadata = { title: "Próximos" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const VER = [["todo", "Todo"], ["pagar", "A pagar"], ["cobrar", "A cobrar"]] as const;
// Un proyectado sale de un pago que se repite: se crea recién al pagarlo o cancelarlo.
type Row = OpenItem & { proj?: { ruleId: string; occ: string; variable: boolean } };

export default async function ProximosMovil({ searchParams }: { searchParams: Promise<{ ver?: string; meses?: string; listo?: string; corregido?: string; borrado?: string; cancelado?: string; guardado?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const in7 = new Date(today.getTime() + 7 * 864e5);
  const thisMonth = period(today);
  const all12 = sp.meses === "12";
  const horizon = periodEnd(addMonths(thisMonth, all12 ? 12 : 2));
  const ver = VER.some(([k]) => k === sp.ver) ? sp.ver! : "todo";
  const [open, projRaw] = await Promise.all([openObligations(db, workspace.id, today, { until: horizon }), projectedItems(db, workspace.id, today, horizon)]);
  const proj: Row[] = projRaw.map((p) => ({
    id: `p-${p.ruleId}-${p.occurrence.toISOString().slice(0, 10)}`, direction: p.direction, description: p.description, currency: p.currency, dueDate: p.dueDate,
    economicPeriod: period(p.occurrence), amount: p.amount, remaining: p.amount, certainty: "PROBABLE", overdue: false, status: "PENDING", category: null,
    proj: { ruleId: p.ruleId, occ: p.occurrence.toISOString().slice(0, 10), variable: p.variable },
  }));
  const rows: Row[] = [...open, ...proj]
    .filter((o) => ver === "todo" || o.direction === (ver === "pagar" ? "PAYABLE" : "RECEIVABLE"))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const groups: [string, Row[]][] = [
    ["Atrasado", rows.filter((o) => o.overdue)],
    ["Esta semana", rows.filter((o) => !o.overdue && o.dueDate <= in7)],
    ["Resto del mes", rows.filter((o) => !o.overdue && o.dueDate > in7 && period(o.dueDate) === thisMonth)],
  ];
  for (const p of [...new Set(rows.filter((o) => o.dueDate > in7 && period(o.dueDate) !== thisMonth).map((o) => period(o.dueDate)))].sort()) {
    groups.push([fmtPeriod(p), rows.filter((o) => !o.overdue && o.dueDate > in7 && period(o.dueDate) === p)]);
  }
  const sum = (l: OpenItem[], dir: "PAYABLE" | "RECEIVABLE") => l.filter((o) => o.currency === cur && o.direction === dir).reduce((s, o) => s.plus(o.remaining), ZERO);
  const week = open.filter((o) => o.overdue || o.dueDate <= in7);
  const lateCount = open.filter((o) => o.overdue).length;
  const back = `/movil/proximos${sp.ver ? `?ver=${sp.ver}` : ""}`;
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ver: ver === "todo" ? null : ver, meses: all12 ? "12" : null, ...patch })) if (v) p.set(k, v);
    return `/movil/proximos${p.size ? `?${p}` : ""}`;
  };

  return (
    <main className="mv-main">
      {sp.listo && <Toast text={sp.listo === "cobro" ? "Listo, registramos el cobro." : "Listo, registramos el pago."} />}
      {(sp.corregido || sp.guardado) && <Toast text={sp.guardado ? "Listo, quedó agendado." : "Listo, guardamos los cambios."} />}
      {(sp.borrado || sp.cancelado) && <Toast text={sp.borrado ? "Listo, lo eliminamos." : "Listo, lo cancelamos."} />}
      <header className="mv-head">
        <h1 className="mv-hello" style={{ fontSize: 24, letterSpacing: "-.02em" }}>Próximos</h1>
        <Link className="mv-chip" href="/movil/cargar?estado=pendiente" style={{ background: "var(--card)" }}>+ Agregar</Link>
      </header>

      <section className="mv-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Esta semana sale</div>
          <div style={{ fontSize: 22, marginTop: 2 }}><CountUp className="mv-num mv-amt" value={sum(week, "PAYABLE").toNumber()} currency={cur} /></div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Esta semana entra</div>
          <div style={{ fontSize: 22, marginTop: 2 }} className="pos"><CountUp className="mv-num mv-amt" value={sum(week, "RECEIVABLE").toNumber()} currency={cur} /></div>
        </div>
        {lateCount > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 13, fontWeight: 800, color: "#A3231B" }}>Tienes {lateCount} {lateCount === 1 ? "pago atrasado" : "pagos atrasados"}.</div>}
      </section>

      <nav className="mv-chips" aria-label="Filtrar">
        {VER.map(([k, label]) => <Link key={k} href={href({ ver: k === "todo" ? null : k })} className={ver === k ? "on" : ""} aria-current={ver === k ? "true" : undefined}>{label}</Link>)}
      </nav>

      {rows.length === 0 && <div className="mv-card mv-empty">No hay nada pendiente por ahora.</div>}
      {groups.filter(([, l]) => l.length).map(([title, items]) => (
        <section key={title} className="mv-sec" style={{ gap: 8 }}>
          <div className="mv-sec-head" style={{ fontSize: 13, fontWeight: 800, color: title === "Atrasado" ? "#A3231B" : "var(--muted)" }}><span>{title}</span></div>
          <div className="mv-card-list mv-cas">
            {items.map((o) => {
              const rec = o.direction === "RECEIVABLE";
              const date = <span className="mv-date" style={o.overdue ? { background: "#FDECEA", color: "#A3231B" } : undefined}><b style={{ fontSize: 15 }}>{o.dueDate.getUTCDate()}</b><small style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{MES[o.dueDate.getUTCMonth()]}</small></span>;
              const body = (
                <span className="grow">
                  <span className="t" style={{ display: "block" }}>{o.description}</span>
                  <span className="s">{o.proj ? `Se repite${o.proj.variable ? " · aproximado" : ""}` : o.overdue ? "Atrasado" : rec ? "A cobrar" : "A pagar"}</span>
                </span>
              );
              const amount = <b className={`v mv-num mv-amt ${rec ? "pos" : ""}`}>{rec ? "+ " : ""}{formatMoney(o.remaining, o.currency)}</b>;
              if (o.proj) return (
                <div key={o.id} className="mv-row" style={{ flexWrap: "wrap" }}>
                  {date}{body}{amount}
                  <div className="mv-rowacts">
                    <form action={projectedAction}>
                      <input type="hidden" name="ruleId" value={o.proj.ruleId} /><input type="hidden" name="occurrence" value={o.proj.occ} /><input type="hidden" name="do" value="pagar" /><input type="hidden" name="back" value={back} />
                      <button className="mv-btn pri" type="submit">{rec ? "Registrar cobro" : "Registrar pago"}</button>
                    </form>
                    <form action={projectedAction}>
                      <input type="hidden" name="ruleId" value={o.proj.ruleId} /><input type="hidden" name="occurrence" value={o.proj.occ} /><input type="hidden" name="do" value="cancelar" /><input type="hidden" name="back" value={`${back}${back.includes("?") ? "&" : "?"}cancelado=1`} />
                      <ConfirmSubmit className="mv-btn" question={`¿Cancelar ${o.description} del ${o.dueDate.getUTCDate()} de ${MES[o.dueDate.getUTCMonth()]}? Se saca solo esta vez.`} yes="Sí, cancelar">Esta vez no</ConfirmSubmit>
                    </form>
                  </div>
                </div>
              );
              return (
                <div key={o.id} className="mv-row" style={{ flexWrap: "wrap" }}>
                  <Link href={`/movil/proximos/${o.id}`} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>{date}{body}{amount}</Link>
                  <div className="mv-rowacts">
                    <Link className="mv-btn pri" href={`/movil/proximos/${o.id}`}>{rec ? "Registrar cobro" : "Registrar pago"}</Link>
                    <form action={cancelObligationAction}>
                      <input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={`${back}${back.includes("?") ? "&" : "?"}cancelado=1`} />
                      <ConfirmSubmit className="mv-btn" question={`¿Cancelar ${o.description}? Ya no se va a ${rec ? "cobrar" : "pagar"} y deja de aparecer acá.`} yes="Sí, cancelar">Cancelar</ConfirmSubmit>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {!all12 && rows.length > 0 && <Link className="mv-btn" href={href({ meses: "12" })} style={{ flex: "none", borderColor: "var(--field-line)" }}>Ver los próximos 12 meses</Link>}
    </main>
  );
}
