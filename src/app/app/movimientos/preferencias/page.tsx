import Link from "next/link";
import { requireWorkspace, canUse } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { experienceFrom } from "@/lib/experience";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { experienceAction } from "./actions";
import { PreferenceForm } from "./preference-form";
export const metadata = { title: "Favoritos y reglas" };
export default async function Preferences() {
  const { workspace, plan } = await requireWorkspace();
  const db = getDb(), prefs = experienceFrom(workspace.modules), pro = await canUse(plan, "informes");
  const [accounts, categories] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, select: { id: true, name: true, currency: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { workspaceId: workspace.id, archived: false }, select: { id: true, name: true, kind: true }, orderBy: { name: "asc" } }),
  ]);
  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? "Revisar categoría";
  const remove = (action: string, id: string) => <ActionForm action={experienceAction}><input type="hidden" name="action" value={action} /><input type="hidden" name="id" value={id} /><Submit className="btn sm ghost">Quitar</Submit></ActionForm>;
  return <>
    <PageHead crumb="Mi dinero" title="Favoritos y reglas" desc="Cargá más rápido, siempre revisando antes de guardar." actions={<Link className="btn" href="/app/movimientos/nuevo">Cargar movimiento</Link>} />
    <section className="card product-section"><div className="chead"><div><h2>Favoritos</h2><p className="sub">Hasta 20 conceptos habituales. Completan cuenta y categoría; vos ingresás el importe. No programan pagos.</p></div><span className="pill">Gratis</span></div>
      {prefs.favorites.length > 0 && <div className="list">{prefs.favorites.map(f => <div className="li" key={f.id}><div className="grow"><b>{f.name}</b><div className="s">{f.kind === "EXPENSE" ? "Gasto" : "Ingreso"} · {accounts.find(a => a.id === f.accountId)?.name ?? "Revisar cuenta"}{f.categoryId ? ` · ${categoryName(f.categoryId)}` : ""}</div></div>{remove("removeFavorite", f.id)}</div>)}</div>}
      <details className="more"><summary>Agregar o actualizar un favorito</summary><PreferenceForm accounts={accounts} categories={categories} mode="favorite" /></details>
    </section>
    <section className="card product-section"><div className="chead"><div><h2>Reglas de categoría</h2><p className="sub">Hasta 30 reglas por espacio. Si el concepto contiene el texto, se sugiere una categoría. La primera coincidencia tiene prioridad y podés cambiarla antes de guardar.</p></div><span className="pill">Pro</span></div>
      {prefs.rules.length > 0 && <div className="list">{prefs.rules.map(r => <div className="li" key={r.id}><div className="grow"><b>{r.contains}</b><div className="s">{r.kind === "EXPENSE" ? "Gasto" : "Ingreso"} → {categoryName(r.categoryId)}</div></div>{remove("removeRule", r.id)}</div>)}</div>}
      {pro ? <details className="more"><summary>Agregar o actualizar una regla</summary><PreferenceForm accounts={accounts} categories={categories} mode="rule" /></details> : <p className="sub">Las reglas guardadas se conservan al volver a Gratis, pero dejan de sugerirse. <Link className="lnk" href="/app/configuracion?tab=plan">Ver Pro</Link></p>}
      <p className="sub">No cambian movimientos anteriores ni crean gastos. El equipo de tu espacio comparte estos favoritos y reglas según sus permisos.</p>
    </section>
  </>;
}
