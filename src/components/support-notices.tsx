"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
export function SupportNotices() {
  const [count,setCount]=useState(0);
  useEffect(()=>{
    let active=true;
    async function refresh(){if(document.hidden)return;try{const r=await fetch("/admin/api/soporte",{cache:"no-store"});if(r.ok){const d=await r.json();if(active)setCount(d.unread);}}catch{}}
    void refresh();const timer=setInterval(refresh,45000);window.addEventListener("focus",refresh);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[]);
  return <Link className="btn sm" href="/admin/soporte/avisos" aria-label={`Avisos de atención${count?`: ${count} sin leer`:""}`}>Avisos{count>0&&<span className="pill">{count}</span>}</Link>;
}
