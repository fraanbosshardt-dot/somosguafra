import { ZERO, type MoneyValue, dec } from "@/lib/money";
import type { OpenItem } from "./ledger";

export function spendableUntil(cash: MoneyValue, items: Pick<OpenItem, "direction" | "currency" | "dueDate" | "remaining">[], currency: string, today: Date, until: Date, includesLastDay: boolean) {
  const owed = items.filter((o) => o.currency === currency && o.direction === "PAYABLE" && o.dueDate <= until).reduce((s, o) => s.plus(o.remaining), ZERO);
  const left = dec(cash).minus(owed);
  // Hasta el cobro se presupuesta hasta el día anterior. A fin de mes se incluye también el último día.
  const days = Math.max(1, Math.round((until.getTime() - today.getTime()) / 864e5) + (includesLastDay ? 1 : 0));
  return { owed, left, days, perDay: left.gt(0) ? left.dividedBy(days).round() : ZERO };
}
