"use client";
import { useEffect, useState } from "react";
import { ActionForm, Submit, type FormState } from "./forms";
import { adminCaseToolsAction } from "@/app/actions/admin";

export function CaseManagementForm({kind,id,assignedTo,revision,me,team}:{
  kind:"contact"|"ticket";id:string;assignedTo:string|null;revision:string;me:string;
  team:{email:string;role:string}[];
}) {
  const [responsible,setResponsible]=useState(assignedTo??"");
  const [note,setNote]=useState(""),[review,setReview]=useState(false);
  useEffect(()=>setResponsible(assignedTo??""),[assignedTo]);
  async function save(state:FormState,data:FormData) {
    const result=await adminCaseToolsAction(state,data);
    if(result?.ok){setResponsible(String(data.get("assignedTo")??""));setNote("");setReview(false);}
    return result;
  }
  return <ActionForm action={save} className="adm-management-form">
    <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={revision}/>
    <p className="sub">Derivá el mismo caso a una persona del equipo. Las notas son internas y no se envían al cliente.</p>
    <label className="field">Responsable<select name="assignedTo" value={responsible} onChange={e=>setResponsible(e.target.value)}>
      <option value="">Sin asignar</option>{team.map(m=><option key={m.email} value={m.email}>{m.email}{m.email===me?" (yo)":""}{m.role==="OWNER"?" · Dueño":" · Soporte"}</option>)}
      {assignedTo&&!team.some(m=>m.email===assignedTo)&&<option value={assignedTo}>{assignedTo} · sin acceso actual</option>}
    </select></label>
    <label className="check"><input type="checkbox" name="review" value="yes" checked={review} onChange={e=>setReview(e.target.checked)}/>Solicitar revisión interna al responsable</label>
    <label className="field">Nota interna<textarea name="note" rows={3} maxLength={3000} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <div className="adm-form-actions"><Submit>Guardar gestión</Submit></div>
  </ActionForm>;
}
