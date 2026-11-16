import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { reservePdfRead, completePdfRead, releasePdfRead } from "@/server/pdf-quota";
import { pdfLines } from "@/server/statement-pdf";
import { extractPdfLines } from "@/server/pdf-worker";
let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t?.stop(); });
it("parallel PDF reads reserve the last slot atomically, failed parsing releases it, success consumes it once", async () => {
  const u = await t.db.user.create({ data: { email: "pdf-quota@audit.invalid", name: "Fixture", passwordHash: "" } });
  const w = await createWorkspaceForUser(t.db, u.id);
  const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => reservePdfRead(t.db, w.id, u.id, "card", 1)));
  expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
  const reserved = attempts.find(r => r.status === "fulfilled")!;
  if (reserved.status !== "fulfilled") throw Error("missing fixture");
  await releasePdfRead(t.db, reserved.value);
  const second = await reservePdfRead(t.db, w.id, u.id, "card", 1);
  await completePdfRead(t.db, second, ["total"]);
  await expect(completePdfRead(t.db, second, [])).rejects.toThrow("venció");
  await expect(reservePdfRead(t.db, w.id, u.id, "card", 1)).rejects.toThrow("límite");
  expect(await t.db.auditLog.count({ where: { workspaceId: w.id, action: "card.pdf_read" } })).toBe(1);
});
function fixturePdf() {
  const stream = "BT /F1 12 Tf 72 720 Td (This is a safe synthetic PDF fixture for the audit and contains no personal data.) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let doc = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((o, i) => { offsets.push(doc.length); doc += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = doc.length;
  doc += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(doc));
}
it("extracts a fictitious PDF in an isolated worker and terminates on deadline", async () => {
  const lines = await pdfLines(fixturePdf(), { maxPages: 1, what: "el resumen" });
  expect(lines.map(l => l.text).join(" ")).toContain("safe synthetic PDF");
  await expect(extractPdfLines(fixturePdf(), 1, 1)).rejects.toThrow("parse-timeout");
  await expect(pdfLines(fixturePdf(), { maxPages: 0, what: "el resumen" })).rejects.toThrow("demasiadas páginas");
});
