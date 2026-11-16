"use client";
import { useState,useEffect,useRef } from "react";

// Caja de respuesta con las respuestas guardadas a mano.
export function ReplyBox({ replies, name }: { replies: { title: string; text: string }[]; name: string }) {
  const [text, setText] = useState("");
  const input=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{const form=input.current?.form;const reset=()=>setText("");form?.addEventListener("reset",reset);return()=>form?.removeEventListener("reset",reset);},[]);
  return (
    <>
      {replies.length > 0 && (
        <select className="st-sel" aria-label="Usar una respuesta guardada" defaultValue="" onChange={(e) => { const r = replies.find((x) => x.title === e.target.value); if (r) setText(r.text.replaceAll("{nombre}", name)); }} style={{ alignSelf: "flex-start" }}>
          <option value="">Usar una respuesta guardada…</option>
          {replies.map((r) => <option key={r.title} value={r.title}>{r.title}</option>)}
        </select>
      )}
      <label className="field">Respuesta<textarea ref={input} name="reply" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Hola ${name}…`} /></label>
    </>
  );
}
