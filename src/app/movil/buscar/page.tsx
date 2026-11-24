import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { searchIds } from "@/server/search";
import { MvBackHead } from "../head";
import { MvIcon } from "../ui";

export const metadata: Metadata = { title: "Buscar" };

// Busca en movimientos, pendientes, cuentas, categorías, pagos que se repiten, deudas y ventas de cereal (sin importar acentos).
export default async function BuscarMovil({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { workspace } = await requireWorkspace();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const db = getDb();
  const ws = workspace.id;
  const found = q.length >= 2 ? await searchIds(db, ws, q) : null;
  const inIds = (ids?: string[]) => ({ workspaceId: ws, id: { in: ids ?? [] } });
  const [tx, obl, accounts, cats, rules, debts, grain] = found ? await Promise.all([
    db.transaction.findMany({ where: inIds(found.tx), include: { account: true, category: true }, orderBy: { effectiveDate: "desc" }, take: 60 }),
    db.obligation.findMany({ where: inIds(found.obl), orderBy: { dueDate: "asc" } }),
    db.account.findMany({ where: inIds(found.accounts) }),
    db.category.findMany({ where: inIds(found.cats) }),
    db.recurringRule.findMany({ where: inIds(found.rules) }),
    db.debt.findMany({ where: inIds(found.debts) }),
    db.grainSale.findMany({ where: inIds(found.grain), orderBy: { saleDate: "desc" } }),
  ]) : [[], [], [], [], [], [], []];
  const total = tx.length + obl.length + accounts.length + cats.length + rules.length + debts.length + grain.length;
  const head = (t: string) => <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>{t}</h2>;
  const row = (key: string, href: string, t: string, s: string, v?: React.ReactNode) => (
    <Link key={key} className="mv-row" href={href}><span className="grow"><span className="t" style={{ display: "block" }}>{t}</span><span className="s">{s}</span></span>{v}</Link>
  );
  return (
    <main className="mv-main">
      <MvBackHead href="/movil" title="Buscar" />
      <form className="mv-search" role="search">
        <MvIcon name="search" />
        <input type="search" name="q" defaultValue={q} placeholder="Movimientos, cuentas, categorías…" aria-label="Buscar" autoFocus />
      </form>
      {q.length < 2 ? <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>Escribe al menos 2 letras.</p>
        : total === 0 ? <div className="mv-card mv-empty">No encontramos nada con «{q}».</div> : (
        <>
          {obl.length > 0 && <section className="mv-sec" style={{ gap: 8 }}>{head("A pagar y a cobrar")}<div className="mv-card-list">{obl.map((o) => row(o.id, `/movil/proximos/${o.id}`, o.description, `Vence el ${fmtDate(o.dueDate)}`, <b className={`v mv-num mv-amt ${o.direction === "RECEIVABLE" ? "pos" : ""}`}>{formatMoney(o.amount, o.currency)}</b>))}</div></section>}
          {tx.length > 0 && <section className="mv-sec" style={{ gap: 8 }}>{head("Movimientos")}<div className="mv-card-list">{tx.map((t) => row(t.id, `/movil/movimientos/${t.id}`, t.description, `${fmtDate(t.effectiveDate)} · ${[t.category?.name, t.account.name].filter(Boolean).join(" · ")}`, <b className={`v mv-num mv-amt ${t.type !== "TRANSFER" && t.direction === "IN" ? "pos" : ""}`}>{t.direction === "IN" ? "+ " : "− "}{formatMoney(t.amount, t.currency)}</b>))}</div></section>}
          {accounts.length + cats.length + rules.length + debts.length + grain.length > 0 && (
            <section className="mv-sec" style={{ gap: 8 }}>{head("Otros")}<div className="mv-card-list">
              {debts.map((d) => row(d.id, `/movil/explorar/deudas/${d.id}`, d.creditor, `Deuda · ${d.kind}`))}
              {grain.map((g) => row(g.id, "/movil/explorar/cereal", `Venta de ${g.grain.toLowerCase()}`, `Venta de cereal · ${fmtDate(g.saleDate)}`))}
              {accounts.map((a) => row(a.id, `/movil/explorar/cuentas/${a.id}`, a.name, `Cuenta · ${a.currency}`))}
              {cats.map((c) => row(c.id, "/movil/explorar/categorias", c.name, "Categoría"))}
              {rules.map((r) => row(r.id, `/movil/explorar/recurrentes/${r.id}`, r.description, `Se repite · ${formatMoney(r.amount, r.currency)}`))}
            </div></section>
          )}
        </>
      )}
    </main>
  );
}
