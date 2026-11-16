// Safe HTTP smoke test for the built local server; no browser, payment writes or real credentials.
import { spawn } from "node:child_process";
const base = "http://127.0.0.1:3107";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3107"], {
  env: { ...process.env, MP_ACCESS_TOKEN: "", MP_WEBHOOK_SECRET: "", RESEND_API_KEY: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }, stdio: "ignore",
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("El servidor de prueba terminó antes de iniciar.");
    try { if ((await fetch(base + "/api/health", { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  if (!ready) throw Error("El servidor local no quedó listo.");
  for (const path of ["/", "/registro", "/contacto", "/terminos", "/sitemap.xml", "/robots.txt"]) {
    const r = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (r.status !== 200) throw Error(`Smoke test falló en ${path}: ${r.status}`);
    await r.arrayBuffer();
  }
  for (const path of ["/app", "/admin"]) {
    const r = await fetch(base + path, { redirect: "manual" });
    if (![303, 307, 308].includes(r.status)) throw Error(`Acceso anónimo no bloqueado en ${path}`);
    if (!r.headers.get("cache-control")?.includes("no-store")) throw Error(`Falta no-store en ${path}`);
  }
  for (const path of ["/api/cron/cobros", "/api/health/operaciones"]) {
    if ((await fetch(base + path)).status !== 401) throw Error(`Falta autorización en ${path}`);
  }
  console.log("Smoke HTTP local: páginas públicas, redirects privados y autorización operacional correctos.");
} finally { server.kill(); }
