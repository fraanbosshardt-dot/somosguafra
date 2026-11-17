import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { CaseTools } from "@/components/support-inbox";
import { SupportThread } from "@/components/support-thread";
import { ActionForm, Submit } from "@/components/forms";
import {
  adminReplyContactAction,
  adminReplyTicketAction,
} from "@/app/actions/admin";
import { adminChatStateAction } from "@/app/actions/chat-admin";
import { CASE_STATUS } from "@/lib/chat-help";
import { SupportComposer } from "@/components/support-composer";
import { activeSupportTeam } from "@/server/support-operations";
import { SupportRefresh } from "@/components/support-refresh";
import { savedReplies } from "@/server/settings";
import { botChatStatus } from "@/lib/chat-session";
export default async function Conversation({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const admin = await requireAdmin("support");
  const { kind, id } = await params,
    db = getDb();
  if (!["contact", "ticket", "bot"].includes(kind)) notFound();
  if (kind === "bot") {
    const chat = await db.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    if (!chat) notFound();
    if (chat.contactId) redirect(`/admin/soporte/contact/${chat.contactId}`);
    const status = botChatStatus(chat.botResolved, chat.updatedAt);
    return (
      <>
        <Link className="lnk" href="/admin/soporte?canal=bot">
          ← Conversaciones
        </Link>
        <SupportRefresh />
        <div className="card">
          <h1>{chat.code}</h1>
          <p className="sub">
            Atención automática ·{" "}
            {status === "RESOLVED" ? "Resuelta por la persona" : status === "CLOSED" ? "Finalizada por inactividad" : "Sin derivación"}.
            La persona puede pedir atención del equipo desde Guafra.
          </p>
          <SupportThread
            body=""
            messages={chat.messages}
            skipInitial
            internal
          />
        </div>
      </>
    );
  }
  const c =
    kind === "contact"
      ? await db.contactMessage.findUnique({
          where: { id },
          include: {
            chatSession: true,
            messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          },
        })
      : await db.supportTicket.findUnique({
          where: { id },
          include: {
            user: true,
            messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          },
        });
  if (!c) notFound();
  const editing=await db.supportReplyLease.findFirst({where:{id:`${kind}/${id}`,expiresAt:{gt:new Date()}},select:{ownerEmail:true}});
  const name = "name" in c ? c.name : c.user.name,
    email = "email" in c ? c.email : c.user.email,
    chat = "chatSession" in c && !!c.chatSession;
  return (
    <>
      <Link className="lnk" href="/admin/soporte">
        ← Conversaciones
      </Link>
      <SupportRefresh />
      <div className="card">
        <p className="sub">
          {c.code} · {"area" in c ? c.area : "soporte"}
        </p>
        <h1 style={{ overflowWrap: "anywhere" }}>{c.subject}</h1>
        <p>
          {name} · {email}
        </p>
        <p className="sub">
          {c.userId
            ? "Cuenta vinculada; verificá identidad antes de cambios sensibles."
            : "Visitante: el correo indicado no acredita identidad."}
        </p>
        <SupportThread
          body={c.body}
          reply={c.reply}
          messages={c.messages}
          skipInitial={chat}
          internal
        />
        <CaseTools
          kind={kind as "contact" | "ticket"}
          id={id}
          assignedTo={c.assignedTo}
          revision={c.updatedAt.toISOString()} me={admin.email} team={await activeSupportTeam(db)}
        />
        <div>{editing&&<p className="notice">{editing.ownerEmail} está preparando una respuesta. La reserva es temporal.</p>}</div>
        <SupportComposer key={`composer/${kind}/${id}`} kind={kind as "contact"|"ticket"} id={id} revision={c.updatedAt.toISOString()}
          name={name.split(" ")[0]} code={c.code} area={"area" in c && c.area!=="soporte" ? c.area : /contrase|correo|acceso|sesión/i.test(c.subject)?"acceso":"soporte"} replies={await savedReplies(db)}/>
        <hr style={{ margin: "28px 0" }} />
        <ActionForm
          key={`${c.status}/${c.priority}`}
          action={adminChatStateAction}
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input
            type="hidden"
            name="revision"
            value={c.updatedAt.toISOString()}
          />
          <label className="field">
            Estado
            <select name="status" defaultValue={c.status}>
              {Object.entries(CASE_STATUS).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Prioridad
            <select name="priority" defaultValue={c.priority}>
              <option value="HIGH">Alta</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Baja</option>
            </select>
          </label>
          <Submit>Actualizar caso</Submit>
        </ActionForm>
      </div>
    </>
  );
}
