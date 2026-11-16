import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({
  session: null as any,
  contact: vi.fn(),
  ticket: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => state.session,
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    contactMessage: { findFirst: state.contact },
    supportTicket: { findFirst: state.ticket },
  }),
}));
import { GET } from "@/app/soporte/abrir/route";
const request = (code = "SG-ABC123456789") =>
  new NextRequest(
    `http://internal-host:3000/soporte/abrir?caso=${encodeURIComponent(code)}`,
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "https://somosguafra.com");
  state.session = {
    user: { id: "owner", totpEnabledAt: null },
    twoFactorVerified: true,
  };
  state.contact.mockResolvedValue({ id: "own-case" });
  state.ticket.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());
it("el retorno usa el dominio configurado y conserva el código, no el host interno", async () => {
  const r = await GET(request());
  expect(r.headers.get("location")).toBe(
    "https://somosguafra.com/app/ayuda?chat=SG-ABC123456789",
  );
  expect(state.contact).toHaveBeenCalledWith({
    where: { code: "SG-ABC123456789", userId: "owner" },
    select: { id: true },
  });
});
it("exige iniciar sesión y conserva únicamente un destino relativo permitido", async () => {
  state.session = null;
  const r = await GET(request());
  expect(r.headers.get("location")).toBe("https://somosguafra.com/ingresar");
  expect(r.cookies.get("somosguafra_after")?.value).toBe(
    "/soporte/abrir?caso=SG-ABC123456789",
  );
  expect(r.headers.get("set-cookie")).toContain("HttpOnly");
  expect(state.contact).not.toHaveBeenCalled();
});
it("exige completar el segundo factor antes de consultar la propiedad", async () => {
  state.session.user.totpEnabledAt = new Date();
  state.session.twoFactorVerified = false;
  expect((await GET(request())).headers.get("location")).toBe(
    "https://somosguafra.com/verificar",
  );
  expect(state.contact).not.toHaveBeenCalled();
});
it("un código ajeno o un destino manipulado no abre otra cuenta ni otro sitio", async () => {
  state.contact.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(404);
  expect((await GET(request("//attacker.invalid"))).status).toBe(400);
});
