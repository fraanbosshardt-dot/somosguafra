import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import Link from "next/link";
import { PageHead } from "@/components/page";
import { Pagination } from "@/components/pagination";
import { pageNumber } from "@/lib/pagination";
import { AREAS } from "@/lib/brand";
import { ADMIN_CASE_STATUS } from "@/lib/chat-help";
import { unifiedInbox } from "@/server/support-inbox";
import { when } from "@/components/admin-ui";
import { savedReplies } from "@/server/settings";
import { ActionForm, Submit } from "@/components/forms";
import { SupportRefresh } from "@/components/support-refresh";
import { can } from "@/server/admin-team";
import { REPLY_AREAS } from "@/lib/support-replies";
import {
  adminSaveReplyAction,
  adminDeleteReplyAction,
} from "@/app/actions/admin";
export async function AdminSupportInbox({
  searchParams, scope = "chat",
}: {
  searchParams: Promise<Record<string, string | undefined>>;
  scope?: "chat" | "site";
}) {
  const a = await requireAdmin(scope === "site" ? "view" : "support"),
    p = await searchParams,
    page = pageNumber(p.pagina),
    status =
      p.estado ??
      (p.ver === "todas"
        ? "all"
        : p.ver === "cerradas"
          ? "CLOSED"
          : p.ver === "respondidas"
            ? "ANSWERED"
            : "open");
  const site = scope === "site", base = site ? "/admin/consultas" : "/admin/soporte";
  const db = getDb(),
    [{ rows, total }, replies] = await Promise.all([
      unifiedInbox(db, {
        status, scope,
        query: p.q,
        channel: site ? "contact" : p.canal,
        page,
        assigned: p.mias === "1" ? a.email : undefined,
        area: AREAS.some((a) => a.key === p.area) ? p.area : undefined,
      }),
      savedReplies(db),
    ]);
  const url = (n: number) =>
    `${base}?${new URLSearchParams({
      estado: status,
      q: p.q ?? "",
      canal: p.canal ?? "all",
      mias: p.mias ?? "",
      area: p.area ?? "",
      pagina: String(n),
    })}`;
  return (
    <>
      <PageHead
        title={site ? "Consultas del sitio" : "Conversaciones"}
        desc={site ? "Mensajes enviados desde los formularios del sitio. Cada consulta conserva su código e historial." : "Casos derivados a una persona y chats atendidos por Guafra, en vistas separadas."}
      />
      <div className="adm-inbox-toolbar"><div className="seg"><Link className={`segl ${p.canal !== "bot" ? "on" : ""}`} href={base}>{site ? "Formularios del sitio" : "Para el equipo"}</Link>{!site && <Link className={`segl ${p.canal === "bot" ? "on" : ""}`} href="/admin/soporte?canal=bot&estado=all">Solo bot</Link>}</div><SupportRefresh /></div>
      {can(a.role, "owner") && !site && (
        <div className="acts">
          <Link className="lnk" href="/admin/soporte/respuestas">
            Administrar respuestas automáticas de Guafra →
          </Link>
        </div>
      )}
      <form
        className="card"
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <label className="field" style={{ flex: "1 1 220px" }}>
          Buscar
          <input
            name="q"
            defaultValue={p.q}
            placeholder="Código, nombre, correo o asunto"
            maxLength={120}
          />
        </label>
        {p.canal === "bot" ? <input type="hidden" name="estado" value="all"/> : <label className="field">
          Estado
          <select name="estado" defaultValue={status}>
            <option value="open">Pendientes del equipo</option>
            <option value="all">Todos los estados</option>
            {Object.entries(ADMIN_CASE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>}
        {!site && <label className="field">
          Canal
          <select name="canal" defaultValue={p.canal ?? "all"}>
            <option value="all">Chat y ayuda de la app</option>
            <option value="contact">Chat con el equipo</option>
            <option value="ticket">Ayuda de la app</option>
            <option value="bot">Solo automáticas</option>
          </select>
        </label>}
        <label className="field">
          Motivo
          <select name="area" defaultValue={p.area ?? ""}>
            <option value="">Todos los motivos</option>
            {AREAS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="mias"
            value="1"
            defaultChecked={p.mias === "1"}
          />
          Asignadas a mí
        </label>
        <button className="btn pri">Filtrar</button>
      </form>
      <p className="sub">
        {total} {total === 1 ? "resultado" : "resultados"} · {site ? "Formularios del sitio" : p.canal === "bot" ? "Atención automática: no requieren respuesta del equipo" : "Atención de una persona"}
      </p>
      <div className="adm-inbox-results" aria-label="Resultados de la bandeja">
      {rows.map((c) => (
        <Link
          className="adm-inbox-row"
          key={`${c.kind}-${c.id}`}
          href={site ? `/admin/consultas/${c.id}` : `/admin/soporte/${c.kind}/${c.id}`}
        >
          <div className="chead">
            <div>
              <span className="sub">
                {c.code} ·{" "}
                {c.kind === "bot"
                  ? "Guafra automático"
                  : c.kind === "contact"
                    ? (c.source === "site" ? "Formulario del sitio" : "Chat con el equipo")
                    : "Ayuda de la app"}
              </span>
              <h3 style={{ overflowWrap: "anywhere" }}>{c.subject}</h3>
              <p className="sub">
                {c.name} {c.email && `· ${c.email}`}
              </p>
            </div>
            <span className={`pill ${c.priority === "HIGH" ? "r" : ""}`}>
              {ADMIN_CASE_STATUS[c.status] ?? "Automática"}
            </span>
          </div>
          <p className="sub">
            {when(c.at)} ·{" "}
            {c.assigned ? `Asignada a ${c.assigned}` : "Sin asignar"} ·
            Prioridad{" "}
            {c.priority === "HIGH"
              ? "alta"
              : c.priority === "LOW"
                ? "baja"
                : "normal"}
          </p>
        </Link>
      ))}
      {!rows.length && (
        <div className="empty">No hay conversaciones con estos filtros.</div>
      )}
      </div>
      <Pagination page={page} size={25} total={total} href={url} />
      {can(a.role,"support") && <details className="card">
        <summary>Respuestas guardadas para el equipo</summary>
        <p className="sub">Disponibles en cada ticket, filtradas por motivo. Usá {"{nombre}"} y {"{caso}"} para completar el nombre y el código. Las respuestas son borradores: verificá los hechos antes de enviarlas.</p>
        {replies.map((r) => (
          <div className="li" key={r.title}>
            <div className="grow">
              <b>{r.title}</b>
              <small className="sub"> · {REPLY_AREAS[r.area??"general"]??"General"}</small>
              <p className="sub">{r.text}</p>
              <details><summary>Editar respuesta</summary><ActionForm action={adminSaveReplyAction} style={{display:"grid",gap:12,marginTop:12}}>
                <input type="hidden" name="title" value={r.title}/><label className="field">Motivo<select name="area" defaultValue={r.area??"general"}>{Object.entries(REPLY_AREAS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
                <label className="field">Texto<textarea name="text" rows={4} defaultValue={r.text} maxLength={2000} required/></label><Submit>Guardar cambios</Submit>
              </ActionForm></details>
            </div>
            <form action={adminDeleteReplyAction}>
              <input type="hidden" name="title" value={r.title} />
              <button className="btn sm">Borrar</button>
            </form>
          </div>
        ))}
        <ActionForm
          action={adminSaveReplyAction}
          resetOnOk
          style={{ display: "grid", gap: 14, marginTop: 20 }}
        >
          <label className="field">
            Nombre
            <input name="title" required />
          </label>
          <label className="field">Motivo<select name="area" defaultValue="general">{Object.entries(REPLY_AREAS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label className="field">
            Texto
            <textarea
              name="text"
              rows={4}
              required
              placeholder="Hola {nombre}, …"
            />
          </label>
          <Submit>Guardar respuesta</Submit>
        </ActionForm>
      </details>}
    </>
  );
}
