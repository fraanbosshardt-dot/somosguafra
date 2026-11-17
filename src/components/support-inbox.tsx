import Link from "next/link";
import { getDb } from "@/lib/db";
import { CaseManagementForm } from "./case-management-form";
export async function SupportInboxSummary() {
  const db = getDb(); const [tickets, contacts] = await Promise.all([db.supportTicket.count({ where: { status: {in:["OPEN","IN_PROGRESS","WAITING_INTERNAL"]} } }), db.contactMessage.count({ where: { status: {in:["OPEN","IN_PROGRESS","WAITING_INTERNAL"]} } })]);
  return <div className="notice"><span><b>Bandeja del equipo</b><br /><Link className="lnk" href="/admin/soporte">Ayuda anterior: {tickets} esperando respuesta</Link> · <Link className="lnk" href="/admin/soporte?canal=contact">Chat y contacto: {contacts} esperando respuesta</Link><br />{process.env.SUPPORT_INBOUND_ENABLED === "true" ? "Recepción por correo habilitada: revisar estado del webhook en Sistema." : "Las conversaciones funcionan en la web. La recepción de respuestas por correo está pendiente de conexión."}</span></div>;
}
export function CaseTools({kind,id,assignedTo,revision,me,team}:{kind:"ticket"|"contact";id:string;assignedTo:string|null;revision:string;me:string;team:{email:string;role:string}[]}) {
  return <details style={{marginBottom:16}}><summary>Responsable y notas internas{assignedTo?` · asignada a ${assignedTo}`:" · sin asignar"}</summary>
    <CaseManagementForm {...{kind,id,assignedTo,revision,me,team}}/>
  </details>;
}
