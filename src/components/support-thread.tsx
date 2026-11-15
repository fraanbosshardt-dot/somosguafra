import { when } from "./admin-ui";
export function SupportThread({ body, reply, messages, internal = false }: { body: string; reply?: string | null; messages: { id: string; role: string; body: string; internal: boolean; createdAt: Date }[]; internal?: boolean }) {
  const visible = messages.filter(m => internal || !m.internal);
  return <div className="support-thread"><div className="support-bubble"><small>Consulta inicial</small>{body}</div>{!visible.some(m => m.role === "staff" && !m.internal) && reply && <div className="support-bubble staff"><small>somosguafra · respuesta anterior</small>{reply}</div>}{visible.map(m => <div key={m.id} className={`support-bubble ${m.internal ? "internal" : m.role === "staff" ? "staff" : ""}`}><small>{m.internal ? "Nota interna · no se envía" : m.role === "staff" ? "somosguafra" : "Cliente"} · {when(m.createdAt)}</small>{m.body}</div>)}</div>;
}
