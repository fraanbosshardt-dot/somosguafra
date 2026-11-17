import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { parseAmount } from "@/lib/money";
import { parseDate, addMonths, period, periodEnd } from "@/lib/dates";
import { UserError } from "./ledger";

const KEYS = ["tipo", "precio", "cuotas", "interes", "total", "primera", "colchon", "tab", "gastos", "extra", "invertir", "sin"];
export function simulationParams(fd: FormData, today: Date) {
  const params = Object.fromEntries(KEYS.map((k) => [k, String(fd.get(k) ?? "").trim()]));
  if (Object.values(params).some((v) => v.length > 100)) throw new UserError("Revisá los datos de la simulación.");
  if (params.tab === "escenarios") {
    const pct = Number(params.gastos || 0);
    if (!Number.isFinite(pct) || pct < -100 || pct > 1000) throw new UserError("El cambio de gastos debe estar entre −100% y 1000%.");
    for (const k of ["extra", "invertir"]) if (params[k] && (!parseAmount(params[k]) || parseAmount(params[k])!.lt(0) || parseAmount(params[k])!.gte("10000000000000000"))) throw new UserError("Revisá los importes de tu escenario.");
  } else {
    const price = parseAmount(params.precio), n = Number(params.cuotas);
    const first = parseDate(params.primera);
    if (!price?.gt(0) || price.gte("10000000000000000")) throw new UserError("Escribí un precio o préstamo positivo dentro del rango permitido.");
    if (!Number.isInteger(n) || n < 1 || n > 48) throw new UserError("Elegí entre 1 y 48 cuotas.");
    if (!first || first < today || first > periodEnd(addMonths(period(today), 12))) throw new UserError("Elegí una primera cuota entre hoy y los próximos 12 meses.");
    if (params.interes === "con" && (!parseAmount(params.total)?.gt(0) || parseAmount(params.total)!.lt(price) || parseAmount(params.total)!.gte("10000000000000000"))) throw new UserError("El total financiado debe ser igual o mayor al importe inicial.");
    if (params.colchon && (!parseAmount(params.colchon) || parseAmount(params.colchon)!.lt(0) || parseAmount(params.colchon)!.gte("10000000000000000"))) throw new UserError("El colchón debe ser un importe positivo o cero.");
  }
  return params;
}

export function sealSimulation(params: Record<string, string>, userId: string, workspaceId: string, now = Date.now()) {
  return encryptSecret(JSON.stringify({ kind: "simulation-v1", userId, workspaceId, expires: now + 3600_000, params }));
}
export function openSimulation(token: string, userId: string, workspaceId: string, now = Date.now()): Record<string, string> | null {
  try {
    if (!token || token.length > 4096) return null;
    const data = JSON.parse(decryptSecret(token));
    if (data.kind !== "simulation-v1" || data.userId !== userId || data.workspaceId !== workspaceId || !Number.isSafeInteger(data.expires) || data.expires <= now || data.expires > now + 3900_000 || !data.params || typeof data.params !== "object" || Array.isArray(data.params)) return null;
    if (Object.entries(data.params).some(([k, v]) => !KEYS.includes(k) || typeof v !== "string" || v.length > 100)) return null;
    return data.params;
  } catch { return null; }
}
