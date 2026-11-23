"use server";
import { requireWritableWorkspace, canUse } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { autoMap, previewImport, xlsxToCsv, ofxToCsv } from "@/server/io";
import { importFingerprint, importMatches } from "@/server/import-review";
import { UserError } from "@/server/ledger";
import { reportError } from "@/lib/diagnostics";
export type FileReview = { fingerprint: string; currency: string; count: number; duplicates: number; errors: { line: number; reason: string }[]; rows: { key: string; date: string; description: string; amount: string; repeatedInFile: boolean; candidates: { id: string; description: string; date: string }[] }[]; assisted: boolean };
export async function reviewFile(fd: FormData): Promise<{ error: string } | FileReview> {
  const { workspace, plan } = await requireWritableWorkspace();
  try {
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5_000_000) throw new UserError("Elegí un archivo de hasta 5 MB.");
    const ext = file.name.toLowerCase().split(".").pop() ?? "", pro = await canUse(plan, "informes");
    if (!["csv", "xlsx", "ofx", "qfx"].includes(ext)) throw new UserError("Usá CSV, Excel (.xlsx) u OFX.");
    if (ext !== "csv" && !pro) throw new UserError("Excel y OFX son parte de Pro. Podés usar CSV en Gratis.");
    const text = ext === "xlsx" ? xlsxToCsv(Buffer.from(await file.arrayBuffer())) : ext === "ofx" || ext === "qfx" ? ofxToCsv(await file.text()) : await file.text();
    const accountId = String(fd.get("accountId") ?? "");
    const account = await getDb().account.findFirst({ where: { id: accountId, workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } });
    if (!account) throw new UserError("Elegí una cuenta activa de dinero.");
    const preview = await previewImport(getDb(), workspace.id, account.id, text, autoMap(text));
    if (preview.ok.length > 2000) throw new UserError("Revisá hasta 2.000 movimientos por archivo. Dividí el extracto en archivos más chicos.");
    const matches = pro ? await importMatches(getDb(), workspace.id, account.id, preview) : [];
    return { fingerprint: importFingerprint(account.id, text, preview, matches), currency: account.currency, count: preview.ok.length, duplicates: preview.duplicates, errors: preview.errors.slice(0, 30), assisted: pro,
      rows: preview.ok.map(r => ({ key: r.key, date: r.date.toISOString().slice(0,10), description: r.description, amount: r.amount.toFixed(2), repeatedInFile:!!r.repeatedInFile, candidates: matches.find(m => m.key === r.key)?.candidates ?? [] })) };
  } catch (e) { if (!(e instanceof UserError)) reportError("import-review", e); return { error: e instanceof UserError ? e.message : "No pudimos revisar. Probá nuevamente." }; }
}
