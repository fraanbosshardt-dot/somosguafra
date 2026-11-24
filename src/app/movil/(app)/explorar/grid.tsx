"use client";
import Link from "next/link";
import { useState } from "react";
import { MvIcon, type MvIconName } from "../ui";

export type ExItem = { href: string; label: string; sub: string; icon: MvIconName; tone: "green" | "amber" | "blue" | "gray"; badge?: string; bar?: number; wide?: boolean; pro?: boolean };
export type ExGroup = { title: string; items: ExItem[] };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Todas las funciones, agrupadas, con un buscador arriba.
export function ExplorarGrid({ groups }: { groups: ExGroup[] }) {
  const [q, setQ] = useState("");
  const query = norm(q.trim());
  const shown = groups.map((g) => ({ ...g, items: query ? g.items.filter((i) => norm(`${i.label} ${i.sub}`).includes(query)) : g.items })).filter((g) => g.items.length);
  return (
    <>
      <label className="mv-search">
        <MvIcon name="search" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar una función" aria-label="Buscar una función" />
      </label>
      {shown.length === 0 && <div className="mv-card mv-empty">No encontramos esa función.</div>}
      {shown.map((g) => (
        <section key={g.title} className="mv-sec" style={{ gap: 8 }}>
          <h2 className="mv-sec-head" style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>{g.title}</h2>
          <div className="mv-exgrid mv-cas">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className={`mv-ex ${i.wide && !query ? "wide" : ""}`}>
                <span className="ex-top">
                  <span className={`ex-ic ${i.tone}`}><MvIcon name={i.icon} /></span>
                  {i.badge && <span className="ex-badge">{i.badge}</span>}
                  {i.pro && <span className="ex-pro">PRO</span>}
                </span>
                <b>{i.label}</b>
                <span className="ex-sub">{i.sub}</span>
                {i.bar !== undefined && <span className="ex-bar"><i className="mv-grow-x" style={{ width: `${Math.max(3, Math.min(100, i.bar))}%` }} /></span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
