"use client";
import {useEffect,useRef,useState} from "react";
import {ActionForm,Submit} from "./forms";
import {adminReplyContactAction,adminReplyTicketAction} from "@/app/actions/admin";
import {ReplyBox} from "@/app/admin/(panel)/soporte/reply-box";
import type {SavedSupportReply} from "@/lib/support-replies";
export function SupportComposer({kind,id,revision,name,code,area,replies}:{kind:"contact"|"ticket";id:string;revision:string;name:string;code:string;area:string;replies:SavedSupportReply[]}) {
  const [holding,setHolding]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[token,setToken]=useState("");
  const root=useRef<HTMLDivElement>(null),held=useRef<{token:string;revision:string}|null>(null);
  async function operation(action:string,value:string,version:string){
    const r=await fetch("/admin/api/soporte",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,kind,id,token:value,revision:version}),cache:"no-store"});
    const d=await r.json();if(!r.ok)throw Error(d.error||"No pudimos reservar la conversación.");return d;
  }
  async function claim(){setBusy(true);setError("");const value=crypto.randomUUID();try{await operation("claim",value,revision);held.current={token:value,revision};setToken(value);setHolding(true);}catch(e){setError(e instanceof Error?e.message:"No pudimos reservar el caso.");}finally{setBusy(false);}}
  function release(){const h=held.current;held.current=null;setHolding(false);if(h)void operation("release",h.token,h.revision).catch(()=>{});}
  useEffect(()=>{
    const form=root.current?.querySelector("form");const reset=()=>release();form?.addEventListener("reset",reset);
    return()=>{form?.removeEventListener("reset",reset);const h=held.current;if(h)void fetch("/admin/api/soporte",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"release",kind,id,token:h.token,revision:h.revision}),keepalive:true}).catch(()=>{});};
  },[kind,id]);
  useEffect(()=>{if(held.current&&held.current.revision!==revision){release();setError("Hay cambios en el caso. Revisá el historial y volvé a tomarlo; tu borrador se conserva.");}},[revision]);
  useEffect(()=>{
    if(!holding)return;let active=true;
    const timer=setInterval(async()=>{if(document.hidden)return;const h=held.current;if(!h)return;try{await operation("renew",h.token,h.revision);}catch(e){if(active){held.current=null;setHolding(false);setError(e instanceof Error?e.message:"La reserva venció; tu borrador se conserva.");}}},25000);
    return()=>{active=false;clearInterval(timer);};
  },[holding,kind,id]);
  return <div ref={root} className="adm-composer">
    <div className="notice" style={{display:"block",marginBottom:16}}><b>{holding?"Estás preparando la respuesta":"Tomá la conversación antes de responder"}</b><p className="sub">Tomalo para evitar respuestas simultáneas. Si la reserva vence, tu borrador se conserva.</p>
    {holding?<button type="button" className="btn sm" onClick={release}>Liberar para otra persona</button>:<button type="button" className="btn pri" disabled={busy} onClick={()=>void claim()}>{busy?"Reservando…":"Tomar para responder"}</button>}</div>
    {error&&<p className="notice error" role="alert">{error}</p>}
    <ActionForm resetOnOk action={kind==="contact"?adminReplyContactAction:adminReplyTicketAction} style={{display:"grid",gap:16}}>
      <input type="hidden" name="id" value={id}/><input type="hidden" name="leaseToken" value={token}/><input type="hidden" name="revision" value={revision}/>
      <fieldset disabled={!holding} style={{border:0,padding:0,margin:0,minWidth:0,display:"grid",gap:16}}><ReplyBox replies={replies} name={name} code={code} area={area}/><p className="sub">La respuesta queda en el caso. El correo avisa al cliente para volver a esta conversación.</p><Submit pending="Guardando…">Responder al cliente</Submit></fieldset>
    </ActionForm>
  </div>;
}
