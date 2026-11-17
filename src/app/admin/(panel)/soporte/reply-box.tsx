"use client";
import { useState,useEffect,useRef } from "react";
import {REPLY_AREAS,fillSupportReply,type SavedSupportReply} from "@/lib/support-replies";

// Caja de respuesta con las respuestas guardadas a mano.
export function ReplyBox({ replies, name, code="", area="general" }: { replies: SavedSupportReply[]; name: string;code?:string;area?:string }) {
  const [text, setText] = useState("");
  const [query,setQuery]=useState(""),[filter,setFilter]=useState(area),[selected,setSelected]=useState("");
  const list=replies.filter(r=>(filter==="all"||r.area===filter||r.area==="general"||!r.area)&&`${r.title} ${r.text}`.toLowerCase().includes(query.toLowerCase()));
  const chosen=replies.find(r=>r.title===selected);
  const preview=chosen?fillSupportReply(chosen.text,{name,code}):"";
  const input=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{const form=input.current?.form;const reset=()=>{setText("");setSelected("");setQuery("");};form?.addEventListener("reset",reset);return()=>form?.removeEventListener("reset",reset);},[]);
  return (
    <>
      <details className="adm-saved-picker">
        <summary>Usar una respuesta guardada</summary><div className="adm-picker-content">
        <div className="acts"><label className="field" style={{flex:"1 1 180px"}}>Buscar respuesta<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ej.: pago, contraseña, reclamo"/></label>
        <label className="field">Motivo<select value={filter} onChange={e=>{setFilter(e.target.value);setSelected("");}}><option value="all">Todos</option>{Object.entries(REPLY_AREAS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
        <label className="field">Elegir respuesta<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Elegí una respuesta para previsualizar…</option>{list.map(r=><option key={r.title} value={r.title}>{r.title}</option>)}</select></label>
        {!list.length&&<p className="sub">No hay respuestas con este filtro. Probá con Todos o escribí tu respuesta debajo.</p>}
        {chosen&&<><p style={{whiteSpace:"pre-wrap",margin:0}}>{preview}</p><button className="btn sm" type="button" style={{justifySelf:"start"}} onClick={()=>{setText(value=>value?`${value}\n\n${preview}`:preview);input.current?.focus();}}>{text?"Agregar al borrador":"Usar esta respuesta"}</button></>}
        <p className="sub" style={{margin:0}}>Revisá y adaptá el borrador. Elegir una respuesta no envía ningún mensaje.</p>
      </div></details>
      <label className="field">Respuesta<textarea ref={input} name="reply" rows={5} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Hola ${name}…`} /></label>
    </>
  );
}
