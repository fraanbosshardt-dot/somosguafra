import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({ search: vi.fn(), db: Object.fromEntries(["transaction", "obligation", "account", "category", "recurringRule", "debt", "grainSale"].map(key => [key, { findMany: vi.fn() }])) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/lib/auth/session", () => ({ requireWorkspace: async () => ({ workspace: { id: "workspace-demo", baseCurrency: "ARS" } }) }));
vi.mock("@/server/search", () => ({ searchIds: mocks.search }));
vi.mock("@/components/page", () => ({ PageHead: () => null }));
import Search from "@/app/app/buscar/page";

beforeEach(() => { vi.clearAllMocks(); for (const model of Object.values(mocks.db)) model.findMany.mockResolvedValue([]); });
const empty = { tx: [], obl: [], accounts: [], cats: [], rules: [], debts: [], grain: [] };
it("no consulta siete tablas nuevamente si la búsqueda no encontró ids", async () => {
  mocks.search.mockResolvedValueOnce(empty);
  const html = renderToStaticMarkup(await Search({ searchParams: Promise.resolve({ q: "inexistente" }) }));
  expect(html).toContain("No encontramos nada");
  expect(Object.values(mocks.db).every(model => model.findMany.mock.calls.length === 0)).toBe(true);
});
it("carga solo los grupos encontrados manteniendo el filtro del espacio", async () => {
  mocks.search.mockResolvedValueOnce({ ...empty, accounts: ["account-demo"] });
  mocks.db.account.findMany.mockResolvedValueOnce([{ id: "account-demo", name: "Cuenta demo", currency: "ARS" }]);
  const html = renderToStaticMarkup(await Search({ searchParams: Promise.resolve({ q: "demo" }) }));
  expect(html).toContain("Cuenta demo");
  expect(mocks.db.account.findMany).toHaveBeenCalledWith({ where: { workspaceId: "workspace-demo", id: { in: ["account-demo"] } } });
  expect(Object.entries(mocks.db).filter(([key]) => key !== "account").every(([, model]) => model.findMany.mock.calls.length === 0)).toBe(true);
});
