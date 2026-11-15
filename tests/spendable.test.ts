import { expect, it } from "vitest";
import { spendableUntil } from "@/server/spendable";
import { dec } from "@/lib/money";
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const pay = (date: string, currency = "ARS") => ({ direction: "PAYABLE" as const, currency, dueDate: day(date), remaining: dec(100) });
it("reserva los pagos del último día y cuenta ese día en el presupuesto mensual", () => {
  const result = spendableUntil(1000, [pay("2026-11-30"), pay("2026-12-01"), pay("2026-11-30", "USD")], "ARS", day("2026-11-15"), day("2026-11-30"), true);
  expect(result.owed.toFixed()).toBe("100"); expect(result.left.toFixed()).toBe("900"); expect(result.days).toBe(16);
});
it("reserva vencimientos del mismo día del cobro sin dar por cobrado ese ingreso", () => {
  const result = spendableUntil(1000, [pay("2026-12-01")], "ARS", day("2026-11-30"), day("2026-12-01"), false);
  expect(result.days).toBe(1); expect(result.left.toFixed()).toBe("900");
});
it("el último día y el déficit no provocan división por cero ni gasto diario positivo", () => {
  const result = spendableUntil(50, [pay("2026-11-30")], "ARS", day("2026-11-30"), day("2026-11-30"), true);
  expect(result.days).toBe(1); expect(result.left.toFixed()).toBe("-50"); expect(result.perDay.isZero()).toBe(true);
});
