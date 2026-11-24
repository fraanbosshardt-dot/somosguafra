import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { accountBalances } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { isoDate, todayIn } from "@/lib/dates";
import { createAccountAction } from "@/app/actions/app";
import { FREE_LIMITS } from "@/lib/modules";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";
import { CURRENCIES, currencyName } from "@/lib/countries";
import { MvBackHead } from "../../head";
import { MvForm, MvSubmit } from "../../form-ui";
import { CountUp, MvIcon } from "../../ui";

export const metadata: Metadata = { title: "Cuentas" };
const GROUPS: [string, string[]][] = [["Efectivo", ["CASH"]], ["Bancos", ["SAVINGS", "CHECKING"]], ["Billeteras virtuales", ["WALLET"]], ["En otra moneda", ["FOREIGN"]], ["Inversiones", ["INVESTMENT"]], ["Otras", ["OTHER"]]];

export default async function CuentasMovil({ searchParams }: { searchParams: Promise<{ nueva?: string; limite?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const cur = workspace.baseCurrency;
  const [accounts, balances] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, type: { not: "CREDIT_CARD" } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    accountBalances(db, workspace.id, todayIn(workspace.timezone)),
  ]);
  const act = accounts.filter((a) => a.active), ina = accounts.filter((a) => !a.active);
  const bal = (id: string) => balances.get(id) ?? ZERO;
  const total = act.filter((a) => a.currency === cur && a.type !== "INVESTMENT").reduce((s, a) => s.plus(bal(a.id)), ZERO);
  const others = [...new Set(act.filter((a) => a.currency !== cur).map((a) => a.currency))];
  const atLimit = !(await canUse(plan, "ilimitado")) && act.length >= FREE_LIMITS.accounts;
  const groups = GROUPS.map(([label, types]) => ({ label, list: act.filter((a) => types.includes(a.type)) })).filter((g) => g.list.length);
  const row = (a: (typeof accounts)[number]) => {
    const b = bal(a.id);
    const odd = b.isNegative() && a.type !== "INVESTMENT";
    return (
      <Link key={a.id} className="mv-row" href={`/movil/explorar/cuentas/${a.id}`}>
        <span className="mv-date"><MvIcon name={a.type === "INVESTMENT" ? "scale" : a.type === "CASH" ? "wallet" : "bank"} /></span>
        <span className="grow"><span className="t" style={{ display: "block" }}>{a.name}</span><span className="s" style={odd ? { color: "var(--neg)" } : undefined}>{odd ? "Saldo negativo: revísalo" : a.institution || ACCOUNT_TYPE_LABEL[a.type]}</span></span>
        <b className={`v mv-num mv-amt ${odd ? "neg" : ""}`}>{formatMoney(b, a.currency)}</b>
      </Link>
    );
  };

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Mi dinero" title="Cuentas" />
      {sp.limite && atLimit && <p className="mv-error" role="alert">El plan Gratis incluye {FREE_LIMITS.accounts} cuentas activas. Desactiva otra primero o pasa a Pro.</p>}

      {act.length > 0 && (
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Total disponible en {currencyName(cur).toLowerCase()}</div>
          <div style={{ fontSize: 32, letterSpacing: "-.02em" }}><CountUp className="mv-num mv-amt" value={total.toNumber()} currency={cur} /></div>
          {others.map((c) => <div key={c} style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>En {currencyName(c).toLowerCase()}: <span className="mv-amt">{formatMoney(act.filter((a) => a.currency === c).reduce((s, a) => s.plus(bal(a.id)), ZERO), c)}</span></div>)}
        </section>
      )}

      {groups.map((g) => (
        <section key={g.label} className="mv-sec" style={{ gap: 8 }}>
          {groups.length > 1 && <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>{g.label}</h2>}
          <div className="mv-card-list mv-cas">{g.list.map(row)}</div>
        </section>
      ))}

      <details className="mv-card mv-more" open={sp.nueva === "1" || act.length === 0}>
        <summary>Nueva cuenta</summary>
        {atLimit ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>El plan Gratis incluye {FREE_LIMITS.accounts} cuentas activas. Desactiva una o pasa a Pro.</p>
        ) : (
          <MvForm action={createAccountAction}>
            <input type="hidden" name="back" value="/movil" />
            <label className="mv-lbl">Nombre<input className="mv-input" name="name" placeholder="Ej.: Caja de ahorro sueldo" /></label>
            <label className="mv-lbl">Banco o institución<input className="mv-input" name="institution" placeholder="Opcional" /></label>
            <label className="mv-lbl">Tipo<select className="mv-input" name="type" defaultValue="SAVINGS">{Object.entries(ACCOUNT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="mv-lbl">Moneda<select className="mv-input" name="currency" defaultValue={cur}>{[cur, ...workspace.extraCurrencies, ...CURRENCIES.map((c) => c.code).filter((c) => c !== cur && !workspace.extraCurrencies.includes(c))].map((c) => <option key={c} value={c}>{currencyName(c)} ({c})</option>)}</select></label>
            <label className="mv-lbl">¿Cuánto tiene hoy?<input className="mv-input" name="initialBalance" inputMode="decimal" placeholder="0,00" /></label>
            <input type="hidden" name="initialDate" value={isoDate(todayIn(workspace.timezone))} />
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Desde ahí sumamos y restamos tus movimientos. Las cuentas de inversión no cuentan como dinero disponible.</p>
            <MvSubmit>Crear cuenta</MvSubmit>
          </MvForm>
        )}
      </details>

      {ina.length > 0 && (
        <details className="mv-card mv-more">
          <summary>Cuentas desactivadas ({ina.length})</summary>
          <div className="mv-card-list" style={{ margin: "0 -16px" }}>{ina.map(row)}</div>
        </details>
      )}
    </main>
  );
}
