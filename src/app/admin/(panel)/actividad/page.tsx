import { Pagination } from "@/components/pagination";
import { pageNumber } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { PageHead } from "@/components/page";
import { actionName, when } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Actividad" };
const FILTERS: [string, string, string | null][] = [["", "Todo", null], ["equipo", "Equipo", "admin."], ["ingresos", "Ingresos", "auth."], ["cobros", "Cobros", "billing."], ["tareas", "Tareas", "cron."]];

export default async function Activity({ searchParams }: { searchParams: Promise<{ ver?: string; q?: string; pagina?: string }> }) {
  await requireAdmin("operations");
  const sp = await searchParams;
  const f = FILTERS.find(([k]) => k === (sp.ver ?? "")) ?? FILTERS[0];
  const q = (sp.q ?? "").trim().toLowerCase();
  const page = pageNumber(sp.pagina), db = getDb();
  const where: Prisma.AuditLogWhereInput = {
      ...(f[2] ? { action: { startsWith: f[2] } } : {}),
      ...(q ? { OR: [{ user: { email: { contains: q, mode: "insensitive" } } }, { entityId: { contains: q, mode: "insensitive" } }, { meta: { path: ["admin"], string_contains: q } }] } : {}),
    };
  const [total,logs] = await Promise.all([db.auditLog.count({where}),db.auditLog.findMany({
    where,
    include: { user: { select: { email: true, id: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30, skip:(page-1)*30,
  })]);
  return (
    <>
      <PageHead title="Actividad" desc="Todo lo que pasó, con quién lo hizo. Lo del equipo muestra el correo del panel." />
      <div className="acts">
        <div className="seg">{FILTERS.map(([k, l]) => <Link key={k} className={`segl ${f[0] === k ? "on" : ""}`} href={`/admin/actividad${k ? `?ver=${k}` : ""}`}>{l}</Link>)}</div>
        <form className="acts"><input type="hidden" name="ver" value={f[0]} /><input className="adm-q" name="q" defaultValue={q} placeholder="Buscar por correo" aria-label="Buscar por correo" /><button className="btn" type="submit">Buscar</button></form>
      </div>
      <div className="card"><div className="tw" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table>
        <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué pasó</th><th>Detalle</th></tr></thead>
        <tbody>{logs.map((l) => {
          const m = (l.meta ?? {}) as Record<string, unknown>;
          const who = typeof m.admin === "string" ? `${m.admin} (equipo)` : l.user?.email ?? (l.entity === "email" ? l.entityId : "—");
          const detail = [m.email, m.plan, m.code, m.subject, m.role, m.days !== undefined ? (m.days ? `${m.days} días` : "sin vencimiento") : null, m.via].filter((x) => typeof x === "string" || typeof x === "number").join(" · ");
          return <tr key={l.id}><td style={{ whiteSpace: "nowrap" }}>{when(l.createdAt)}</td><td>{l.user ? <Link className="lnk" href={`/admin/usuarios/${l.user.id}`}>{who}</Link> : who}</td><td>{actionName(l.action)}</td><td>{detail || "—"}</td></tr>;
        })}</tbody>
      </table></div>
      {!logs.length && <div className="empty">Nada para mostrar.</div>}<Pagination page={page} size={30} total={total} href={p=>`/admin/actividad?${new URLSearchParams({ver:f[0],q,pagina:String(p)})}`}/></div>
    </>
  );
}
