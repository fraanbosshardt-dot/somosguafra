import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { when } from "@/components/admin-ui";
import { SupportRefresh } from "@/components/support-refresh";
import { adminReadSupportNoticesAction } from "@/app/actions/chat-admin";
const TITLES:Record<string,string>={NEW:"Nueva consulta",CUSTOMER:"El cliente volvió a escribir",ASSIGNED:"Consulta asignada",REVIEW:"Solicitud de revisión interna",OVERDUE:"Sin respuesta durante 8 horas hábiles"};
export default async function Notices(){
  const a=await requireAdmin("support"),before=new Date();
  const notices=await getDb().adminSupportNotice.findMany({where:{recipient:a.email},orderBy:{updatedAt:"desc"},take:50});
  return <><h1>Avisos de atención</h1><p className="sub">Consultas nuevas, derivaciones y respuestas del cliente. Horarios de Argentina. Los avisos por correo contienen solo el código y un enlace privado al panel.</p><SupportRefresh/>
    <form action={adminReadSupportNoticesAction} className="acts"><input type="hidden" name="before" value={before.toISOString()}/><button className="btn" type="submit">Marcar vistos hasta este momento</button><Link className="btn" href="/admin/soporte">Ir a conversaciones</Link></form>
    {!notices.length&&<div className="empty">Todavía no hay avisos para tu usuario.</div>}
    {notices.map(n=><Link className="card" href={`/admin/soporte/${n.kind}/${n.caseId}`} key={n.id} style={{display:"block",marginTop:12,textDecoration:"none",color:"inherit"}}><b>{!n.readAt&&"● "}{n.code} · {TITLES[n.type]??"Novedad del caso"}</b><p className="sub">{when(n.updatedAt)} · {n.priority==="HIGH"?"Prioridad alta":"Atención del equipo"}</p></Link>)}
  </>;
}
