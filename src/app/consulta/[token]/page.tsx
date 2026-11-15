import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { parentWhere, resolveCaseToken } from "@/server/support-thread";
import { SupportThread } from "@/components/support-thread";
import { ActionForm, Submit } from "@/components/forms";
import { supportFollowupAction } from "@/app/actions/support";
export const dynamic = "force-dynamic";
export const metadata = { title: "Tu consulta · somosguafra", robots: { index: false, follow: false } };
export default async function Case({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const db = getDb(); const c = await resolveCaseToken(db, token);
  if (!c) notFound();
  const messages = await db.supportMessage.findMany({ where: { ...parentWhere(c.kind, c.id), internal: false }, orderBy: { createdAt: "asc" } });
  return <main className="auth-page"><div className="card purchase-summary" style={{ margin: "40px auto" }}><a className="lnk" href="/">somosguafra</a><h1>{c.item.subject}</h1><p className="sub">{c.item.status === "CLOSED" ? "Consulta resuelta. Podés volver a escribir para reabrirla." : c.item.status === "ANSWERED" ? "Esperando tu respuesta" : "Esperando al equipo"}. Este enlace es privado: no lo compartas.</p><SupportThread body={c.item.body} reply={c.item.reply} messages={messages} /><ActionForm action={supportFollowupAction} resetOnOk style={{ display: "grid", gap: 12 }}><input type="hidden" name="token" value={token} /><input type="hidden" name="nonce" value={randomUUID()} /><label className="field">Tu mensaje<textarea name="body" rows={4} maxLength={5000} required /></label><Submit>Enviar mensaje</Submit></ActionForm><p className="sub">No incluyas contraseñas, códigos de acceso ni datos completos de tarjetas.</p></div></main>;
}
