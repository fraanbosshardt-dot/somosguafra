import Link from "next/link";
import { getDb } from "@/lib/db";
import { ActionForm, Submit } from "./forms";
import { adminCaseToolsAction } from "@/app/actions/admin";
export async function SupportInboxSummary() {
  const db = getDb(); const [tickets, contacts] = await Promise.all([db.supportTicket.count({ where: { status: {in:["OPEN","IN_PROGRESS","WAITING_INTERNAL"]} } }), db.contactMessage.count({ where: { status: {in:["OPEN","IN_PROGRESS","WAITING_INTERNAL"]} } })]);
  return <div className="notice"><span><b>Bandeja del equipo</b><br /><Link className="lnk" href="/admin/soporte">Ayuda anterior: {tickets} esperando respuesta</Link> · <Link className="lnk" href="/admin/soporte?canal=contact">Chat y contacto: {contacts} esperando respuesta</Link><br />{process.env.SUPPORT_INBOUND_ENABLED === "true" ? "Recepción por correo habilitada: revisar estado del webhook en Sistema." : "Las conversaciones funcionan en la web. La recepción de respuestas por correo está pendiente de conexión."}</span></div>;
}
export function CaseTools({ kind, id, assignedTo }: { kind: "ticket" | "contact"; id: string; assignedTo: string | null }) {
  return <details style={{ marginBottom: 16 }}><summary>Gestión interna{assignedTo ? ` · asignada a ${assignedTo}` : " · sin asignar"}</summary><ActionForm resetOnOk action={adminCaseToolsAction} style={{ display: "grid", gap: 10, marginTop: 12 }}><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><p className="sub">Las notas quedan solo para el equipo. No se envían por correo.</p><label className="field">Nota interna<textarea name="note" rows={3} maxLength={3000} /></label><label className="check"><input type="checkbox" name="assign" value="me" /> Asignarme esta consulta</label><label className="check"><input type="checkbox" name="unassign" value="yes" /> Quitar asignación</label><Submit>Guardar gestión</Submit></ActionForm></details>;
}
