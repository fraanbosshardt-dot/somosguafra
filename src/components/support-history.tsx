"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function SupportHistory({ children, lastMessage }: {children:ReactNode;lastMessage?:string}) {
  const root=useRef<HTMLDivElement>(null), nearBottom=useRef(true);
  useEffect(()=>{const el=root.current;if(el&&nearBottom.current)el.scrollTop=el.scrollHeight;},[lastMessage]);
  return <div className="adm-thread-scroll" ref={root} tabIndex={0} role="region" aria-label="Historial con desplazamiento"
    onScroll={()=>{const el=root.current;if(el)nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>{children}</div>;
}
