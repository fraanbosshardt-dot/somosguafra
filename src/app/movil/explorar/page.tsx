import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { dashboard } from "@/server/ledger";
import { insights } from "@/server/insights";
import { formatMoney } from "@/lib/money";
import { period, todayIn } from "@/lib/dates";
import { logoutAction } from "@/app/actions/auth";
import { MvIcon } from "../ui";
import { ExplorarGrid, type ExGroup, type ExItem } from "./grid";

export const metadata: Metadata = { title: "Explorar" };

// Todas las funciones de la web, con un dato de cada una para saber cómo vienes.
export default async function Explorar() {
  const { workspace, user, modules, plan } = await requireWorkspace();
  const db = getDb();
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const ws = workspace.id;
  const [d, alerts, cards, debts, rules, budget, goals, simuOk, infoOk, cerealOk] = await Promise.all([
    dashboard(db, ws, cur, today),
    modules.alertas ? insights(db, ws, cur, today) : Promise.resolve([]),
    modules.tarjetas ? db.creditCard.count({ where: { workspaceId: ws, active: true } }) : 0,
    modules.deudas ? db.debt.count({ where: { workspaceId: ws, status: "ACTIVE" } }) : 0,
    db.recurringRule.count({ where: { workspaceId: ws, pausedAt: null, OR: [{ endDate: null }, { endDate: { gte: today } }] } }),
    modules.presupuestos ? db.budget.findUnique({ where: { workspaceId_period: { workspaceId: ws, period: period(today) } }, include: { _count: { select: { lines: true } } } }) : null,
    modules.objetivos ? db.goal.count({ where: { workspaceId: ws } }) : 0,
    canUse(plan, "simulador"), canUse(plan, "informes"), canUse(plan, "cereal"),
  ]);
  const accounts = d.accounts.filter((a) => a.type !== "CREDIT_CARD");
  const urgent = alerts.filter((a) => a.level === "urgent" || a.level === "warn").length;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const pro = plan === "PRO";

  const item = (on: boolean, i: ExItem) => (on ? [i] : []);
  const raw: { title: string; items: ExItem[] }[] = [
    { title: "Mi dinero", items: [
      { href: "/movil/explorar/cuentas", label: "Cuentas", sub: `${n(accounts.length, "cuenta", "cuentas")} · ${formatMoney(d.cash, cur)}`, icon: "wallet", tone: "green" },
      { href: "/movil/explorar/revision", label: "Revisión del mes", sub: "4 pasos para cerrar el mes", icon: "checkCircle", tone: "green" },
      ...item(!!modules.cereal, { href: "/movil/explorar/cereal", label: "Ventas de cereal", sub: "Quintales, precio y neto", icon: "grain", tone: "green", pro: !cerealOk, wide: true }),
    ] },
    { title: "Pagos y deudas", items: [
      ...item(!!modules.tarjetas, { href: "/movil/explorar/tarjetas", label: "Tarjetas de crédito", sub: cards ? `${n(cards, "tarjeta", "tarjetas")} · debes ${formatMoney(d.cardDebt, cur)}` : "Agrega tu tarjeta", icon: "card", tone: "amber" }),
      ...item(!!modules.deudas, { href: "/movil/explorar/deudas", label: "Deudas y préstamos", sub: debts ? n(debts, "deuda activa", "deudas activas") : "Sin deudas activas", icon: "bank", tone: "amber" }),
      { href: "/movil/explorar/recurrentes", label: "Pagos que se repiten", sub: rules ? `${n(rules, "activo", "activos")}: sueldo, alquiler, servicios…` : "Sueldo, alquiler, servicios", icon: "repeat", tone: "amber", wide: true },
    ] },
    { title: "Planificar", items: [
      ...item(!!modules.flujo, { href: "/movil/explorar/flujo", label: "Flujo de caja", sub: "Cómo terminas cada mes", icon: "flow", tone: "blue" }),
      ...item(!!modules.presupuestos, { href: "/movil/explorar/presupuestos", label: "Presupuestos", sub: budget?._count.lines ? n(budget._count.lines, "categoría", "categorías") + " este mes" : "Arma el de este mes", icon: "pie", tone: "blue" }),
      ...item(!!modules.objetivos, { href: "/movil/explorar/objetivos", label: "Objetivos de ahorro", sub: goals ? n(goals, "objetivo", "objetivos") : "Crea tu primer objetivo", icon: "target", tone: "blue" }),
      ...item(!!modules.simulador, { href: "/movil/explorar/simulador", label: "Simulador", sub: "¿Puedo comprarlo en cuotas?", icon: "sliders", tone: "blue", pro: !simuOk }),
    ] },
    { title: "Patrimonio y análisis", items: [
      ...item(!!modules.inversiones, { href: "/movil/explorar/patrimonio", label: "Inversiones y patrimonio", sub: `Invertido ${formatMoney(d.invested, cur)}`, icon: "scale", tone: "gray" }),
      ...item(!!modules.alertas, { href: "/movil/explorar/alertas", label: "Alertas y consejos", sub: urgent ? n(urgent, "cosa para revisar", "cosas para revisar") : "Todo en orden", icon: "bell", tone: "gray", badge: urgent ? String(urgent) : undefined }),
      ...item(!!modules.informes, { href: "/movil/explorar/informes", label: "Informes", sub: "Tus últimos meses", icon: "file", tone: "gray", pro: !infoOk }),
    ] },
  ];
  const groups: ExGroup[] = raw.map((g) => ({ ...g, items: g.items.map((i, k, all) => ({ ...i, wide: i.wide || (k === all.length - 1 && all.length % 2 === 1) })) })).filter((g) => g.items.length);

  const initials = (user.name ?? user.email).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <main className="mv-main">
      <header className="mv-head">
        <h1 className="mv-hello" style={{ fontSize: 24, letterSpacing: "-.02em" }}>Explorar</h1>
        <Link className="mv-avatar" href="/movil/explorar/configuracion" aria-label="Tu cuenta y configuración">{initials}</Link>
      </header>

      <ExplorarGrid groups={groups} />

      {!pro && (
        <Link href="/movil/explorar/pro" className="mv-card mv-procard">
          <span><b>Pasa a Pro</b><span>Simulador, informes, flujo a 5 años y espacio compartido</span></span>
          <span className="mv-btn pri" style={{ flex: "none", height: 40 }}>Ver planes</span>
        </Link>
      )}

      <section className="mv-sec" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Tu cuenta</h2>
        <div className="mv-card-list">
          <div className="mv-row">
            <span className="mv-avatar">{initials}</span>
            <span className="grow"><span className="t" style={{ display: "block" }}>{user.name ?? user.email}</span><span className="s">Plan {pro ? "Pro" : "Gratis"}</span></span>
          </div>
          <Link className="mv-row" href="/movil/explorar/configuracion"><span className="mv-date"><MvIcon name="gear" /></span><span className="grow t">Configuración</span><MvIcon name="chev" /></Link>
          <Link className="mv-row" href="/movil/explorar/ayuda"><span className="mv-date"><MvIcon name="help" /></span><span className="grow t">Ayuda</span><MvIcon name="chev" /></Link>
          <form action={logoutAction}>
            <button type="submit" className="mv-row" style={{ width: "100%", border: "none", borderTop: "1px solid var(--line)", background: "none", font: "inherit", textAlign: "left", cursor: "pointer", color: "#A3231B" }}>
              <span className="mv-date" style={{ background: "#FDECEA" }}><MvIcon name="logout" /></span><span className="grow t">Cerrar sesión</span>
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
