"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { hasChatOpen, requestChatOpen } from "@/lib/open-chat";
import styles from "./guafra-chat.module.css";

// The closed launcher needs no conversation code or answers. Load those on first use.
export function ChatWidget({ source = "site" }: { source?: "site" | "app" }) {
  const [Widget, setWidget] = useState<ComponentType<{ source?: "site" | "app" }> | null>(null);
  const [loading, setLoading] = useState(false), [failed, setFailed] = useState(false);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const load = useCallback(() => {
    if (inFlight.current) return;
    setLoading(true); setFailed(false);
    inFlight.current = import("./guafra-chat").then(module => setWidget(() => module.GuafraChat)).catch(() => {
      inFlight.current = null; setLoading(false); setFailed(true);
    });
  }, []);
  useEffect(() => {
    window.addEventListener("guafra:open", load);
    if (hasChatOpen() || new URLSearchParams(window.location.search).has("chat")) load();
    return () => window.removeEventListener("guafra:open", load);
  }, [load]);
  if (Widget) return <Widget source={source} />;
  return <div className={`${styles.root} ${source === "app" ? styles.app : ""}`}>
    <button className={styles.launch} type="button" aria-label="Abrir chat Guafra" aria-expanded={false} aria-busy={loading} disabled={loading} onClick={() => requestChatOpen()}>
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 1.8-6.2A8.5 8.5 0 1 1 21 11.5Z" /><path d="M7 10h9M7 14h5" /></svg>
      <span>{loading ? "Abriendo…" : failed ? "Reintentar chat" : "Guafra"}</span>
    </button>
    {failed && <p className={styles.lazyError} role="alert">No pudimos abrir el chat. Volvé a tocar el botón de ayuda para reintentar.</p>}
  </div>;
}
