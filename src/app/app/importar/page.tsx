import { ImportForm } from "./import-form";
import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { pageNumber } from "@/lib/pagination";
import { fmtDate } from "@/lib/dates";
import { PageHead, SettingsTabs } from "@/components/page";
import { revertImportAction } from "@/app/actions/modules";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const metadata: Metadata = { title: "Importar y exportar" };

export default async function ImportExport({ searchParams }: { searchParams: Promise<{ ok?: string; pagina?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const pro = await canUse(plan, "informes");
  const sp = await searchParams;
  const db = getDb();
  const requestedPage = pageNumber(sp.pagina);
  const total = await db.importBatch.count({ where: { workspaceId: workspace.id } });
  const pages = Math.max(1, Math.ceil(total / 20)), page = Math.min(pages, requestedPage);
  const [accounts, batches] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.importBatch.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, skip: (page - 1) * 20 }),
  ]);
  return (
    <>
      <PageHead crumb="Configuración" title="Importar y exportar" desc="Traé movimientos desde la planilla o el extracto de tu banco. Cada importación se puede deshacer entera." />
      <SettingsTabs current="importar" />
      {sp.ok && <div className="notice g">Listo, importamos los movimientos.</div>}
      <div className="card">
        <div className="chead"><h3>Importar un archivo</h3></div>
        {accounts.length ? (
          <ImportForm key={total} accounts={accounts.map(a => ({ id:a.id,name:a.name,currency:a.currency }))} pro={pro} />
        ) : <div className="empty">Primero creá una cuenta para los movimientos.</div>}
      </div>
      {batches.length > 0 && (
        <div className="card">
          <div className="chead"><h3>Importaciones</h3><span className="sub">{total} lotes · Página {page} de {pages}</span></div>
          <div className="list">
            {batches.map((b) => (
              <div className="li" key={b.id}>
                <div className="grow"><div className="t">{b.fileName}</div><div className="s">{fmtDate(b.createdAt)} · {b.rows} {b.rows === 1 ? "movimiento" : "movimientos"}{b.status === "REVERTED" ? " · deshecha" : ""}</div></div>
                {b.status !== "REVERTED" && <form action={revertImportAction}><input type="hidden" name="id" value={b.id} /><ConfirmSubmit question="¿Deshacer esta importación? Se anulan sus movimientos." yes="Sí, deshacer">Deshacer</ConfirmSubmit></form>}
              </div>
            ))}
          </div>
        </div>
      )}
      {pages > 1 && <nav className="acts" aria-label="Páginas de importaciones">{page > 1 && <Link className="btn" href={`/app/importar?pagina=${page - 1}`}>Anterior</Link>}{page < pages && <Link className="btn" href={`/app/importar?pagina=${page + 1}`}>Siguiente</Link>}</nav>}
      <div className="card">
        <div className="chead"><h3>Exportar</h3></div>
        <p className="sub" style={{ margin: "0 0 12px", fontSize: 14 }}>Tus datos son tuyos. Descargalos cuando quieras.</p>
        <div className="acts">
          <a className="btn" href="/app/exportar/movimientos" download>Movimientos (CSV para Excel)</a>
          {pro ? <a className="btn" href="/app/exportar/excel" download>Movimientos (Excel)</a> : <Link className="btn" href="/app/configuracion?tab=plan">Excel · Pro</Link>}
          {pro ? <Link className="btn" href="/reporte">Reporte del mes (PDF)</Link> : <Link className="btn" href="/app/configuracion?tab=plan">PDF · Pro</Link>}
          <a className="btn" href="/app/exportar/respaldo" download>Respaldo completo (JSON)</a>
        </div>
      </div>
    </>
  );
}
