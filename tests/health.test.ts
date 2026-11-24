import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => ({ $queryRaw: state.query }) }));
import { GET } from "@/app/api/health/route";
afterEach(() => vi.restoreAllMocks());

it("confirma la base sin datos privados ni caché", async () => {
  state.query.mockResolvedValueOnce([{ value: 1 }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true });
});

it("mantiene el 503 y registra solo la clasificación técnica de la falla", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  state.query.mockRejectedValueOnce(Object.assign(new Error("postgres://private:secret@database.invalid/private"), { name: "PrismaClientKnownRequestError", code: "P1017", meta: { secret: "fixture-private" } }));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false });
  expect(log).toHaveBeenCalledWith("[guafra-error]", { scope: "health.database", type: "PrismaClientKnownRequestError", code: "P1017" });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|database.invalid|fixture-private/);
});
