import { createHash } from "node:crypto";
import type { Db } from "./ledger";
import type { ImportPreview } from "./io";
import { plainConcept } from "@/lib/experience";
import { UserError } from "./ledger";
export function importFingerprint(accountId: string, text: string, preview?: ImportPreview, matches: unknown = []) {
  return createHash("sha256").update(`${accountId}\n${text}\n${JSON.stringify({ keys: preview?.ok.map(r => r.key), errors: preview?.errors, duplicates: preview?.duplicates, matches })}`).digest("hex");
}
export async function importMatches(db: Pick<Db, "transaction">, ws: string, accountId: string, preview: ImportPreview) {
  if (!preview.ok.length) return [];
  const dates = preview.ok.map(r => r.date.getTime());
  const from = new Date(Math.min(...dates) - 3 * 864e5), to = new Date(Math.max(...dates) + 3 * 864e5);
  const existing = await db.transaction.findMany({ where: { workspaceId: ws, accountId, effectiveDate: { gte: from, lte: to }, reversalOfId: null, reversedBy: null }, select: { id: true, amount: true, direction: true, effectiveDate: true, description: true, tags: true }, orderBy:[{effectiveDate:"asc"},{id:"asc"}] });
  // Un débito bancario puede corresponder al total de una compra dividida.
  const splitGroups = new Map<string, typeof existing>();
  for (const item of existing) { const tag = item.tags.find(t=>t.startsWith("guafra:split:")); if(!tag || item.direction !== "OUT") continue; const key=`${tag}|${item.effectiveDate.toISOString()}`; const group=splitGroups.get(key) ?? []; group.push(item); splitGroups.set(key,group); }
  const combined = [...splitGroups.values()].filter(group=>group.length>1).map(group=>({...group[0],amount:group.reduce((sum,t)=>sum.plus(t.amount),group[0].amount.minus(group[0].amount)),description:`${group[0].description} (total de compra dividida)`}));
  const buckets = new Map<string, typeof existing>();
  for (const t of [...existing,...combined]) { const key = `${t.direction}|${t.amount.toFixed(2)}`; const bucket = buckets.get(key) ?? []; bucket.push(t); buckets.set(key, bucket); }
  return preview.ok.flatMap(r => {
    const candidates = (buckets.get(`${r.amount.gt(0) ? "IN" : "OUT"}|${r.amount.abs().toFixed(2)}`) ?? []).filter(t => Math.abs(t.effectiveDate.getTime()-r.date.getTime()) <= 3*864e5);
    if (!candidates.length) return [];
    const exact = candidates.filter(t => t.effectiveDate.getTime() === r.date.getTime() && plainConcept(t.description) === plainConcept(r.description));
    return [{ key: r.key, candidates: (exact.length ? exact : candidates).slice(0, 5).map(t => ({ id: t.id, description: t.description, date: t.effectiveDate.toISOString().slice(0,10) })), exact: exact.length === 1 }];
  });
}
export function selectedImport(preview: ImportPreview, excluded: string[]) {
  const keys = new Set(preview.ok.map(r => r.key));
  if (excluded.length > preview.ok.length || excluded.some(k => !keys.has(k))) throw new UserError("La selección cambió. Revisá el archivo de nuevo.");
  const skip = new Set(excluded);
  return { ...preview, ok: preview.ok.filter(r => !skip.has(r.key)) };
}
