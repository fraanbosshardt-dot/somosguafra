import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount } from "@/server/ledger";
import { openSimulation } from "@/server/private-simulation";
const state = vi.hoisted(() => ({ db: null as any, ctx: null as any, pro: true, location: "" }));
vi.mock("@/lib/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/auth/session", () => ({ requireWorkspace: async () => { if (!state.ctx) throw new Error("AUTH_REQUIRED"); return state.ctx; }, canUse: async () => state.pro }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { state.location = url; throw new Error("REDIRECT"); } }));
import { GET } from "@/app/app/exportar/excel/route";
import { privateSimulationAction } from "@/app/app/simulador/actions";
let t: Awaited<ReturnType<typeof startTestDb>>, otherAccount: string;
beforeAll(async () => {
  t = await startTestDb(); state.db = t.db;
  vi.stubEnv("AUTH_SECRET", "synthetic-usability-route-secret-at-least-32-characters");
  const u = await t.db.user.create({ data: { name: "Demo", email: "route-demo@audit.invalid", passwordHash: "" } });
  const ws = await createWorkspaceForUser(t.db, u.id);
  state.ctx = { user: u, workspace: ws, plan: "PRO" };
  const u2 = await t.db.user.create({ data: { name: "Otro", email: "other-route@audit.invalid", passwordHash: "" } });
  const other = await createWorkspaceForUser(t.db, u2.id);
  otherAccount = (await createAccount(t.db, other.id, { name: "Ajena", type: "SAVINGS", currency: "ARS", initialBalance: 0, initialDate: new Date() })).id;
}, 60000);
afterAll(async () => { await t?.stop(); vi.unstubAllEnvs(); });
it("Excel rechaza filtros inválidos y cuentas de otro espacio; descarga privada mantiene Pro", async () => {
  expect((await GET(new Request("https://example.invalid/app/exportar/excel?desde=2026-99&hasta=2026-12"))).status).toBe(400);
  expect((await GET(new Request(`https://example.invalid/app/exportar/excel?desde=2026-01&hasta=2026-12&cuenta=${otherAccount}`))).status).toBe(404);
  const ok = await GET(new Request("https://example.invalid/app/exportar/excel?desde=2026-01&hasta=2026-12"));
  expect(ok.status).toBe(200); expect(ok.headers.get("cache-control")).toBe("no-store");
  state.pro = false;
  try { expect((await GET(new Request("https://example.invalid/app/exportar/excel"))).status).toBe(403); }
  finally { state.pro = true; }
});
it("simular usa POST y redirige sin importes visibles a un cálculo ligado al actor", async () => {
  const fd = new FormData(); fd.set("precio", "123456.78"); fd.set("cuotas", "6");
  const first = new Date(Date.now() + 864e5 * 15); fd.set("primera", first.toISOString().slice(0, 10));
  await expect(privateSimulationAction(null, fd)).rejects.toThrow("REDIRECT");
  expect(state.location).not.toContain("123456"); expect(state.location).not.toContain("precio=");
  const token = new URL(state.location, "https://example.invalid").searchParams.get("sim")!;
  expect(openSimulation(token, state.ctx.user.id, state.ctx.workspace.id)?.precio).toBe("123456.78");
  const before = state.ctx; state.ctx = null;
  try { await expect(privateSimulationAction(null, fd)).rejects.toThrow("AUTH_REQUIRED"); }
  finally { state.ctx = before; }
});
it("escenarios exigen Pro y un ingreso perteneciente al espacio", async () => {
  const fd = new FormData(); fd.set("tab", "escenarios"); fd.set("gastos", "10");
  state.pro = false;
  try { expect((await privateSimulationAction(null, fd))?.error).toMatch(/Pro/); }
  finally { state.pro = true; }
  fd.set("sin", "foreign-income");
  expect((await privateSimulationAction(null, fd))?.error).toMatch(/este espacio/);
});
