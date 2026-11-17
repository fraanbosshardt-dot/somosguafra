"use client";
// Campo de especie con sugerencias: escribís "gal", "apple" o "btc" y elegís de la lista (con nombre y precio).
import { useEffect, useId, useRef, useState } from "react";

type Hit = { symbol: string; name: string | null; price: number | null; currency: string | null };
const money = (n: number, c: string | null) => `${c === "USD" ? "US$" : "$"} ${n.toLocaleString("es-AR", { maximumFractionDigits: n < 10 ? 4 : 2 })}`;

export function TickerInput({ assetClass, placeholder, per100 }: { assetClass: string; placeholder: string; per100: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [retry, setRetry] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  // Al cambiar de tipo se empieza de nuevo.
  useEffect(() => { setQ(""); setHits([]); setPicked(null); }, [assetClass]);
  useEffect(() => {
    if (!q.trim() || picked?.symbol === q) { setHits([]); setError(""); setSearched(false); setLoading(false); return; }
    const ctl = new AbortController();
    let cancelled = false;
    setError(""); setSearched(false); setHits([]); setActive(-1); setOpen(false);
    const t = setTimeout(async () => {
      setLoading(true);
      const deadline = setTimeout(() => ctl.abort(), 7000);
      try {
        const r = await fetch(`/api/inversiones/buscar?tipo=${assetClass}&q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        if (!r.ok) throw new Error("lookup failed");
        const data = await r.json();
        if (!Array.isArray(data)) throw new Error("invalid response");
        if (!cancelled) { setHits(data); setOpen(true); setActive(-1); setSearched(true); }
      } catch { if (!cancelled) { setHits([]); setError("No pudimos consultar las especies. Revisá tu conexión o volvé a intentar. Podés escribir la especie manualmente."); } }
      finally { clearTimeout(deadline); if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); ctl.abort(); };
  }, [q, assetClass, picked, retry]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (h: Hit) => { setQ(h.symbol); setPicked(h); setOpen(false); };
  return (
    <div className="tk" ref={box}>
      <input name="ticker" value={q} placeholder={placeholder} autoComplete="off" autoCapitalize="characters" role="combobox" aria-expanded={open && hits.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setPicked(null); }}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(hits[active]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && (hits.length > 0 || loading) && (
        <ul className="tk-list" id={listId} role="listbox">
          {loading && !hits.length && <li className="tk-empty">Buscando…</li>}
          {hits.map((h, i) => (
            <li id={`${listId}-${i}`} key={h.symbol + i} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); pick(h); }}>
              <span><b>{h.symbol}</b>{h.name && <span className="sub">{h.name}</span>}</span>
              {h.price != null && <span className="num">{money(h.price, h.currency)}{per100 ? " c/100" : ""}</span>}
            </li>
          ))}
        </ul>
      )}
      {loading && <p className="sub" role="status">Buscando especies…</p>}
      {error && <div role="status"><p className="sub">{error}</p><button className="btn sm" type="button" onClick={() => setRetry((n) => n + 1)}>Volver a intentar</button></div>}
      {!error && !loading && searched && !hits.length && <p className="sub" role="status">No encontramos coincidencias. Podés escribir la especie manualmente.</p>}
      {picked?.price != null && <span className="sub tk-note">Referencia: {money(picked.price, picked.currency)}{per100 ? " cada 100 nominales" : ""}{picked.currency === "USD" ? " · en dólares" : ""}</span>}
    </div>
  );
}
