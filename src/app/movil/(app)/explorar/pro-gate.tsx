import Link from "next/link";
import { MvBackHead } from "../head";

// Pantalla de una función Pro para quien tiene el plan Gratis.
export function MvProGate({ sub, title, text }: { sub: string; title: string; text: string }) {
  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub={sub} title={title} />
      <section className="mv-card mv-procard" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
        <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, letterSpacing: ".06em", padding: "4px 8px", borderRadius: 6, background: "#fff", color: "var(--brand)" }}>PRO</span>
        <b style={{ fontSize: 20 }}>{title} es parte de Pro</b>
        <span style={{ fontSize: 14, color: "#CFE3D6", fontWeight: 600 }}>{text}</span>
        <Link className="mv-btn" href="/movil/explorar/pro" style={{ flex: "none", background: "#fff", color: "var(--brand)", border: "none" }}>Ver planes</Link>
      </section>
    </main>
  );
}
