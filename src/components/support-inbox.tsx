import Link from "next/link";
import { getDb } from "@/lib/db";
import { ActionForm, Submit } from "./forms";
import { adminCaseToolsAction } from "@/app/actions/admin";
export async function SupportInboxSummary() {
  const db = getDb(); const [tickets, contacts] = await Promise.all([db.supportTicket.count({ where: { status: {in:["OPEN","IN_PROGRESS","WAITING_INTERNAL"]} } }), db.contactMessage.count({ where: { status: {in:["OPEN","IN_PROGRESS","WAITING_INTERNAL"]} } })]);
  return <div className="notice"><span><b>Bandeja del equipo</b><br /><Link className="lnk" href="/admin/soporte">Ayuda anterior: {tickets} esperando respuesta</Link> · <Link className="lnk" href="/admin/soporte?canal=contact">Chat y contacto: {contacts} esperando respuesta</Link><br />{process.env.SUPPORT_INBOUND_ENABLED === "true" ? "Recepción por correo habilitada: revisar estado del webhook en Sistema." : "Las conversaciones funcionan en la web. La recepción de respuestas por correo está pendiente de conexión."}</span></div>;
}
export function CaseTools({kind,id,assignedTo,revision,me,team}:{kind:"ticket"|"contact";id:string;assignedTo:string|null;revision:string;me:string;team:{email:string;role:string}[]}) {
  return <details style={{marginBottom:16}}><summary>Responsable y notas internas{assignedTo?` · asignada a ${assignedTo}`:" · sin asignar"}</summary>
    <ActionForm resetOnOk action={adminCaseToolsAction} style={{display:"grid",gap:14,marginTop:16}}>
      <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={revision}/>
      <p className="sub">Derivá el mismo caso a una persona con acceso de atención. Las notas son privadas del equipo.</p>
      <label className="field">Responsable<select name="assignedTo" defaultValue={assignedTo??""}><option value="">Sin asignar</option>{team.map(m=><option key={m.email} value={m.email}>{m.email}{m.email===me?" (yo)":""}{m.role==="OWNER"?" · Dueño":" · Soporte"}</option>)}{assignedTo&&!team.some(m=>m.email===assignedTo)&&<option value={assignedTo}>{assignedTo} · sin acceso actual, elegí otro responsable</option>}</select></label>
      <label className="check"><input type="checkbox" name="review" value="yes"/> Solicitar revisión interna al responsable</label>
      <label className="field">Nota interna<textarea name="note" rows={3} maxLength={3000}/></label><Submit>Guardar gestión</Submit>
    </ActionForm>
  </details>;
}
