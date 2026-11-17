import { NextRequest,NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { can } from "@/server/admin-team";
import { getDb } from "@/lib/db";
import { supportLease } from "@/server/support-operations";
import { UserError } from "@/server/ledger";
import { reportError } from "@/lib/diagnostics";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"cache-control":"private, no-store"}});
export async function GET() {
  const a=await getAdmin();if(!a)return json({error:"Ingresá al panel."},401);
  if(!can(a.role,"support"))return json({error:"Sin permiso de atención."},403);
  return json({unread:await getDb().adminSupportNotice.count({where:{recipient:a.email,readAt:null}})});
}
export async function POST(req:NextRequest) {
  const a=await getAdmin();if(!a)return json({error:"Ingresá al panel."},401);
  if(!can(a.role,"support"))return json({error:"Sin permiso de atención."},403);
  const origin=new URL(process.env.APP_URL||req.url).origin;
  if(req.headers.get("origin")!==origin)return json({error:"Origen inválido."},403);
  try {
    if(!req.headers.get("content-type")?.startsWith("application/json"))return json({error:"Solicitud inválida."},400);
    const reader=req.body?.getReader();if(!reader)return json({error:"Solicitud inválida."},400);
    let size=0,text="";const decoder=new TextDecoder();
    try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048)return json({error:"Solicitud demasiado grande."},413);text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
    let data;try{data=JSON.parse(text);}catch{return json({error:"Solicitud inválida."},400);}
    if(!data || !["contact","ticket"].includes(data.kind) || typeof data.id!=="string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.id) || !["claim","renew","release"].includes(data.action) || typeof data.token!=="string" || typeof data.revision!=="string")return json({error:"Solicitud inválida."},400);
    const result=await supportLease(getDb(),data.kind,data.id,{...a,token:data.token,revision:data.revision},data.action);
    return json(result);
  } catch(e) {
    if(e instanceof UserError)return json({error:e.message},409);
    reportError("[support editor]",e);return json({error:"No pudimos reservar la conversación. Reintentá; tu borrador se conserva."},503);
  }
}
