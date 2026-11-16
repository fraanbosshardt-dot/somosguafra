import Link from "next/link";

export function Pagination({ page, size, total, href, label = "Paginación" }: { page: number; size: number; total: number; href: (page: number) => string; label?: string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages === 1 && page === 1) return null;
  return <nav className="acts" aria-label={label} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 18 }}>
    {page > 2 && <Link className="btn sm" href={href(1)}>Primera página</Link>}
    {page > 1 && <Link className="btn sm" href={href(page - 1)}>Anterior</Link>}
    <span className="sub" role="status">Página {page} de {pages} · {total} registros</span>
    {page < pages && <Link className="btn sm" href={href(page + 1)}>Siguiente</Link>}
  </nav>;
}
