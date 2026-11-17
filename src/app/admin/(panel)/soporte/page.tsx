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
import { SupportInboxSummary } from "@/components/support-inbox";
import { savedReplies } from "@/server/settings";
import { ActionForm, Submit } from "@/components/forms";
import { SupportRefresh } from "@/components/support-refresh";
import { can } from "@/server/admin-team";
import { REPLY_AREAS } from "@/lib/support-replies";
import {
  adminSaveReplyAction,
  adminDeleteReplyAction,
} from "@/app/actions/admin";
export const metadata = { title: "Conversaciones" };
export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const a = await requireAdmin("support"),
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
  const db = getDb(),
    [{ rows, total }, replies] = await Promise.all([
      unifiedInbox(db, {
        status,
        query: p.q,
        channel: p.canal,
        page,
        assigned: p.mias === "1" ? a.email : undefined,
        area: AREAS.some((a) => a.key === p.area) ? p.area : undefined,
      }),
      savedReplies(db),
    ]);
  const url = (n: number) =>
    `/admin/soporte?${new URLSearchParams({
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
        title="Conversaciones"
        desc="Guafra, consultas del sitio y ayuda: un historial por caso."
      />
      <SupportInboxSummary />
      <SupportRefresh />
      {can(a.role, "owner") && (
        <p>
          <Link className="lnk" href="/admin/soporte/respuestas">
            Administrar respuestas automáticas de Guafra →
          </Link>
        </p>
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
        <label className="field">
          Estado
          <select name="estado" defaultValue={status}>
            <option value="open">Pendientes del equipo</option>
            <option value="all">Todos los casos humanos</option>
            {Object.entries(ADMIN_CASE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Canal
          <select name="canal" defaultValue={p.canal ?? "all"}>
            <option value="all">Todos</option>
            <option value="contact">Chat y contacto</option>
            <option value="ticket">Ayuda anterior</option>
            <option value="bot">Solo automáticas</option>
          </select>
        </label>
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
        {total} conversaciones · Las automáticas sin derivación se consultan con
        “Solo automáticas”.
      </p>
      {rows.map((c) => (
        <Link
          className="card"
          style={{ display: "block", textDecoration: "none", color: "inherit" }}
          key={`${c.kind}-${c.id}`}
          href={`/admin/soporte/${c.kind}/${c.id}`}
        >
          <div className="chead">
            <div>
              <span className="sub">
                {c.code} ·{" "}
                {c.kind === "bot"
                  ? "Guafra automático"
                  : c.kind === "contact"
                    ? "Chat / contacto"
                    : "Ayuda"}
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
      <Pagination page={page} size={25} total={total} href={url} />
      <details className="card">
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
      </details>
    </>
  );
}
