export function reviewNextStep({ accountCount, uncheckedId, overdue, uncategorized, month }: { accountCount: number; uncheckedId?: string; overdue: number; uncategorized: number; month: string }) {
  if (!accountCount) return { href: "/app/cuentas?nueva=1", label: "Agregar mi primera cuenta" };
  if (uncheckedId) return { href: `/app/cuentas/${encodeURIComponent(uncheckedId)}`, label: "Revisar el saldo pendiente" };
  if (overdue) return { href: "/app/proximos#atrasados", label: "Revisar los atrasados" };
  if (uncategorized) return { href: `/app/movimientos?mes=${month}&categoria=sin-categoria`, label: "Completar categorías" };
  return { href: "/app/recurrentes", label: "Revisar ingresos y gastos futuros" };
}
