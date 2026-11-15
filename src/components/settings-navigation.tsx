"use client";
import { useRouter } from "next/navigation";
export function SettingsNavigation({ items, current }: { items: { key: string; href: string; label: string }[]; current: string }) {
  const router = useRouter();
  return <label className="field settings-mobile">Sección de Configuración<select value={items.find((item) => item.key === current)?.href ?? items[0].href} onChange={(event) => router.push(event.target.value)}>{items.map((item) => <option key={item.key} value={item.href}>{item.label}</option>)}</select></label>;
}
