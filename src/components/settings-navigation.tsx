"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
export function SettingsNavigation({ items, current }: { items: { key: string; href: string; label: string; group: string }[]; current: string }) {
  const router = useRouter();
  const groups = [...new Set(items.map(item => item.group))];
  return <div className="settings-navigation">
    <label className="field settings-mobile">Sección de Configuración<select value={items.find((item) => item.key === current)?.href ?? items[0].href} onChange={(event) => router.push(event.target.value)}>{groups.map(group => <optgroup label={group} key={group}>{items.filter(item => item.group === group).map((item) => <option key={item.key} value={item.href}>{item.label}</option>)}</optgroup>)}</select></label>
    <nav className="settings-desktop settings-sections" aria-label="Secciones de Configuración">{groups.map(group => <div className="settings-nav-group" key={group}><span className="crumb">{group}</span>{items.filter(item => item.group === group).map(item => <Link key={item.key} href={item.href} aria-current={item.key === current ? "page" : undefined}>{item.label}</Link>)}</div>)}</nav>
  </div>;
}
