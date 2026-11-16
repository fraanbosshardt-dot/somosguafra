import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { startTestDb } from "./helpers/testdb";
const state = vi.hoisted(() => ({ db: null as any, session: null as any }));
vi.mock("@/lib/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => state.session,
}));
import { GET, POST } from "@/app/api/soporte/chat/route";
import { sendChatMessage, chatHash } from "@/server/guafra-chat";
let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  t = await startTestDb();
  state.db = t.db;
  vi.stubEnv("AUTH_SECRET", "chat-route-test-secret-over-32-characters");
  vi.stubEnv("APP_URL", "https://example.invalid");
  vi.stubEnv("RESEND_API_KEY", "");
});
beforeEach(() => {
  state.session = null;
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await t?.stop();
});
function req(
  data: unknown,
  cookie?: string,
  origin = "https://example.invalid",
) {
  return new NextRequest("https://example.invalid/api/soporte/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: typeof data === "string" ? data : JSON.stringify(data),
  });
}
it("GET es privado, no crea casos y entrega solo una cookie técnica HttpOnly", async () => {
  const r = await GET(
    new NextRequest("https://example.invalid/api/soporte/chat"),
  );
  expect(r.headers.get("cache-control")).toContain("no-store");
  expect(r.headers.get("set-cookie")).toContain("HttpOnly");
  expect((await r.json()).cases).toEqual([]);
  expect(await t.db.chatSession.count()).toBe(0);
});
it("rechaza origen ajeno, origen ausente, JSON roto y cuerpos demasiado grandes", async () => {
  for (const origin of ["https://attacker.invalid", ""])
    expect(
      (
        await POST(
          req(
            { action: "message", text: "Hola", nonce: crypto.randomUUID() },
            undefined,
            origin,
          ),
        )
      ).status,
    ).toBe(403);
  expect((await POST(req("{broken-json"))).status).toBe(400);
  expect((await POST(req({ text: "x".repeat(17000) }))).status).toBe(400);
  expect(await t.db.chatSession.count()).toBe(0);
});
it("dos visitantes mantienen conversaciones aisladas aunque conozcan ID y código", async () => {
  const first = await GET(
      new NextRequest("https://example.invalid/api/soporte/chat"),
    ),
    cookie = first.headers.get("set-cookie")!.split(";")[0];
  const sent = await POST(
    req(
      { action: "message", text: "Cómo empezar", nonce: crypto.randomUUID() },
      cookie,
    ),
  );
  expect(sent.status).toBe(200);
  const c = (await sent.json()).current;
  const denied = await POST(
    req(
      { action: "load", selection: { kind: "chat", id: c.id } },
      "somosguafra_chat=" + "b".repeat(43),
    ),
  );
  expect(denied.status).toBe(403);
  const byCode = await GET(
    new NextRequest("https://example.invalid/api/soporte/chat?case=" + c.code, {
      headers: { cookie: "somosguafra_chat=" + "c".repeat(43) },
    }),
  );
  expect((await byCode.json()).current).toBeNull();
});
it("la sesión parcial de segundo factor no puede leer conversaciones de la cuenta", async () => {
  const u = await t.db.user.create({
    data: {
      name: "Fixture",
      email: "api-2fa@audit.invalid",
      passwordHash: "x",
      totpEnabledAt: new Date(),
    },
  });
  const c = await sendChatMessage(
    t.db,
    { user: u, visitorHash: null, ip: null },
    { text: "Mi presupuesto", nonce: crypto.randomUUID() },
  );
  state.session = { user: u, twoFactorVerified: false };
  expect((await POST(req({ action: "load", selection: c }))).status).toBe(403);
  state.session.twoFactorVerified = true;
  const r = await POST(req({ action: "load", selection: c }));
  expect(r.status).toBe(200);
  expect((await r.json()).identity.email).toBe(u.email);
});
it("los errores de infraestructura no exponen datos, stack, mensajes ni tokens", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {}),
    db = state.db;
  state.db = {
    chatSession: {
      findMany: async () => {
        throw new Error("PRIVATE-message-credential-fixture");
      },
    },
  };
  try {
    const r = await GET(
      new NextRequest("https://example.invalid/api/soporte/chat"),
    );
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("PRIVATE");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("PRIVATE");
  } finally {
    state.db = db;
    spy.mockRestore();
  }
});
