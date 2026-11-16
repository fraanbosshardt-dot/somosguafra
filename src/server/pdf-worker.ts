import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import type { PdfLine } from "./statement-pdf";

// Literal JavaScript is intentional: no bundler-generated closures execute inside the isolated worker.
const SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const { getDocumentProxy } = require(workerData.parser);
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(workerData.bytes), { isEvalSupported: false });
    if (pdf.numPages > workerData.maxPages) throw Error('too-many-pages');
    const out = []; let totalChars = 0;
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      try {
        const content = await page.getTextContent();
        if (content.items.length > 20000) throw Error('too-complex');
        const items = content.items.filter(i => typeof i.str === 'string' && i.str.length && i.transform)
          .map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width ?? i.str.length * 5 }));
        const rows = [];
        for (const it of items.sort((a,b) => b.y-a.y || a.x-b.x)) {
          totalChars += it.str.length;
          if (totalChars > 500000) throw Error('too-complex');
          const row = rows.find(r => Math.abs(r[0].y-it.y) <= 3);
          if (row) row.push(it); else rows.push([it]);
        }
        for (const row of rows) {
          row.sort((a,b) => a.x-b.x);
          let text = '', xs = [], end = -Infinity;
          for (const it of row) {
            if (text && it.x-end > 1.5) {
              const gap = Math.max(1,Math.min(6,Math.round((it.x-end)/4)));
              text += ' '.repeat(gap); for(let k=0;k<gap;k++) xs.push(end+k);
            }
            const cw = it.w/Math.max(1,it.str.length);
            for(let k=0;k<it.str.length;k++) xs.push(it.x+k*cw);
            text += it.str; end = it.x+it.w;
          }
          out.push({text,xs});
        }
      } finally { page.cleanup(); }
    }
    parentPort.postMessage({lines:out});
  } catch(e) { parentPort.postMessage({error:/password/i.test(String(e.message))?'password':String(e.message)}); }
  finally { if(pdf) await pdf.destroy(); }
})().catch(() => parentPort.postMessage({error:'parse-failed'}));
`;

export function extractPdfLines(bytes: Uint8Array, maxPages: number, timeoutMs = 15_000): Promise<PdfLine[]> {
  const parser = createRequire(`${process.cwd()}/package.json`).resolve("unpdf");
  return new Promise((resolve, reject) => {
    const worker = new Worker(SOURCE, { eval: true, workerData: { parser, bytes, maxPages },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } });
    let settled = false;
    const finish = (error?: Error, lines?: PdfLine[]) => {
      if (settled) return;
      settled = true; clearTimeout(timer); void worker.terminate();
      if (error) reject(error); else resolve(lines!);
    };
    const timer = setTimeout(() => finish(new Error("parse-timeout")), timeoutMs);
    worker.once("message", (result: { error?: string; lines?: PdfLine[] }) => {
      if (result.error || !Array.isArray(result.lines)) finish(new Error(result.error || "parse-failed"));
      else finish(undefined, result.lines);
    });
    worker.once("error", error => finish(error));
    worker.once("exit", () => { if (!settled) finish(new Error("parse-worker-exited")); });
  });
}
