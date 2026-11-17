"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// Keep panels mounted so switching views does not discard an unfinished form.
export function AdminSections({ items, label = "Vistas de esta sección" }: {
  items: { id: string; label: string; content: ReactNode; columns?: 2 }[];
  label?: string;
}) {
  const [active, setActive] = useState(items[0]?.id);
  const id = useId(), root = useRef<HTMLDivElement>(null);
  const path = usePathname(), previousPath = useRef(path);
  useEffect(() => {
    const selectHash = () => {
      const key = window.location.hash.slice(1).replace(/^panel-/, "");
      if (items.some(item => item.id === key)) setActive(key);
      else if (previousPath.current !== path) setActive(items[0]?.id);
      else setActive(current => items.some(item => item.id === current) ? current : items[0]?.id);
      previousPath.current = path;
    };
    selectHash();
    window.addEventListener("hashchange", selectHash);
    return () => window.removeEventListener("hashchange", selectHash);
  }, [items, path]);
  function select(key: string) {
    setActive(key);
    window.history.replaceState(null, "", `#panel-${key}`);
  }
  return <div className="adm-sections" ref={root}>
    <div className="adm-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => <button type="button" role="tab" key={item.id}
        id={`${id}-tab-${item.id}`} aria-controls={`${id}-${item.id}`}
        aria-selected={active === item.id} tabIndex={active === item.id ? 0 : -1}
        onClick={() => select(item.id)} onKeyDown={event => {
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % items.length;
          else if (event.key === "ArrowLeft") next = (index + items.length - 1) % items.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = items.length - 1;
          else return;
          event.preventDefault(); select(items[next].id);
          root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{item.label}</button>)}
    </div>
    {items.map(item => <section key={item.id} id={`${id}-${item.id}`} role="tabpanel"
      aria-labelledby={`${id}-tab-${item.id}`} hidden={active !== item.id}
      className={`adm-tab-panel${item.columns === 2 ? " adm-panel-columns" : ""}`} tabIndex={0}>{item.content}</section>)}
  </div>;
}
