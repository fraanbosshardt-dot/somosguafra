"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Item = { level: "info" | "good"; title: string; detail: string; href: string };
function keyOf(i: Item) { let h = 2166136261; for (const c of `${i.level}|${i.title}|${i.detail}|${i.href}`) h = Math.imul(h^c.charCodeAt(0),16777619); return String(h>>>0); }
export function InformationAlerts({ items, workspaceId }: { items: Item[]; workspaceId: string }) {
  const key = `guafra:consejos:${workspaceId}`, [hidden,setHidden] = useState<Record<string,number>>({});
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(key) ?? "{}"); if (saved && typeof saved === "object" && !Array.isArray(saved)) setHidden(Object.fromEntries(Object.entries(saved).filter(([,v]) => typeof v === "number" && v>Date.now())) as Record<string,number>); } catch {} },[key]);
  const save = (value: Record<string,number>) => { setHidden(value); try { localStorage.setItem(key,JSON.stringify(value)); } catch {} };
  return <><div className="list">{items.filter(i => !hidden[keyOf(i)] || hidden[keyOf(i)]<=Date.now()).map((i,k) => <div className="li" key={k} style={{gap:12,flexWrap:"wrap"}}><div className="grow"><div className="t" style={{whiteSpace:"normal"}}>{i.title}</div><div className="s">{i.detail}</div></div><div className="acts"><Link className="btn sm" href={i.href}>Revisar</Link><button className="btn sm ghost" type="button" onClick={() => save({...hidden,[keyOf(i)]:Date.now()+7*864e5})}>Posponer 7 días</button></div></div>)}</div>{Object.keys(hidden).length>0 && <button className="btn sm ghost" style={{marginTop:14}} type="button" onClick={() => save({})}>Mostrar consejos pospuestos</button>}<p className="sub">Posponer aplica solo a consejos en este navegador. No oculta vencimientos, problemas de pago ni avisos de seguridad.</p></>;
}
