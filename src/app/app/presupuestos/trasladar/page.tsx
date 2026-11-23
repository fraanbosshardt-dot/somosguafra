import Link from "next/link";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { previewBudgetCarry } from "@/server/budget-carry";
import { formatMoney } from "@/lib/money";
import { addMonths, period, todayIn, fmtPeriod } from "@/lib/dates";
import { UserError } from "@/server/ledger";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { carryAction } from "./actions";
export const metadata = { title: "Trasladar margen" };
export default async function Carry({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const { workspace, plan } = await requireWorkspace(), sp = await searchParams;
  const today = todayIn(workspace.timezone), from = sp.desde ?? addMonths(period(today), -1), cur = workspace.baseCurrency;
  let preview: Awaited<ReturnType<typeof previewBudgetCarry>> | null = null, error = "";
  const allowed = await canUse(plan, "informes");
  if (allowed) try { preview = await previewBudgetCarry(getDb(), workspace.id, from, cur, today); } catch (e) { if (!(e instanceof UserError)) throw e; error = e.message; }
  const occupied = preview ? await getDb().budgetLine.count({where:{budget:{workspaceId:workspace.id,period:preview.to}}})>0 : false;
  const fm = (s: string) => formatMoney(s, cur);
  return <div className="narrow wide"><PageHead crumb="Presupuestos" title="Trasladar margen" desc="Copiá los límites de un mes terminado y sumá su margen positivo al siguiente. Revisalo antes de confirmar." />
    {!allowed && <p className="notice">Esta opción es parte de Pro. Copiar los mismos límites sigue disponible en Gratis. <Link className="lnk" href="/app/configuracion?tab=plan">Ver mi plan</Link></p>}
    {error && <p className="notice" role="status">{error}</p>}
    {occupied && preview && <p className="notice a">{fmtPeriod(preview.to)} ya tiene límites. El desglose de abajo es orientativo; no se reemplaza ni se suma nada sobre ese presupuesto. <Link className="lnk" href={`/app/presupuestos?mes=${preview.to}`}>Revisar el destino</Link></p>}
    {preview && <section className="card product-section"><h2>{fmtPeriod(preview.from)} → {fmtPeriod(preview.to)}</h2><p className="sub">El margen descuenta gastos, pendientes y programados reconocidos por categoría. Un exceso no se traslada como deuda ni genera un ingreso. No es dinero reservado en el banco.</p><div className="tw"><table className="carry-table"><thead><tr><th>Categoría</th><th className="n">Límite anterior</th><th className="n">Margen a sumar</th><th className="n">Nuevo límite</th></tr></thead><tbody>{preview.lines.map(l => <tr key={l.categoryId}><td data-label="Categoría">{l.name}</td><td className="n" data-label="Límite anterior">{fm(l.base)}</td><td className="n" data-label="Margen a sumar">{fm(l.extra)}</td><td className="n" data-label="Nuevo límite"><b>{fm(l.total)}</b></td></tr>)}</tbody></table></div><ActionForm action={carryAction} className="product-form"><input type="hidden" name="from" value={preview.from} /><input type="hidden" name="fingerprint" value={preview.fingerprint} /><p className="sub">Solo se aplica si el destino sigue sin límites. No se repite automáticamente; la opción de proyectar margen se conserva. Si editás el mes anterior después, el destino no se recalcula.</p><div className="acts"><Submit disabled={occupied}>Confirmar traslado</Submit><Link className="btn" href={`/app/presupuestos?mes=${preview.to}`}>Ver presupuesto de destino</Link></div></ActionForm></section>}
    <Link className="lnk" href="/app/presupuestos">Volver a Presupuestos</Link>
  </div>;
}
