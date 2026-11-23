"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCT_GUIDES } from "@/lib/product-guide";
export function ProductGuide() {
  const pathname = usePathname();
  if (!pathname.startsWith("/app/")) return null;
  const guide = PRODUCT_GUIDES[pathname.split("/").slice(2).join("/")] ?? PRODUCT_GUIDES[pathname.split("/")[2]];
  if (!guide) return null;
  return <details className="product-guide"><summary>Guía de esta pantalla</summary><div><b>{guide.title}</b><p>{guide.text}</p><Link className="lnk" href={guide.href}>{guide.next}</Link><span aria-hidden="true"> · </span><Link className="lnk" href="/app/ayuda">Más ayuda</Link></div></details>;
}
