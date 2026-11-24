"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
export function SettingsNavigation({ items, current }: { items: { key: string; href: string; label: string }[]; current: string }) {
  const router = useRouter();
  return <div className="settings-navigation">
    <label className="field settings-mobile">Sección de Configuración<select value={items.find((item) => item.key === current)?.href ?? items[0].href} onChange={(event) => router.push(event.target.value)}>{items.map((item) => <option key={item.key} value={item.href}>{item.label}</option>)}</select></label>
    <nav className="settings-desktop settings-sections" aria-label="Secciones de Configuración">{items.map(item => <Link key={item.key} href={item.href} aria-current={item.key === current ? "page" : undefined}>{item.label}</Link>)}</nav>
  </div>;
}
