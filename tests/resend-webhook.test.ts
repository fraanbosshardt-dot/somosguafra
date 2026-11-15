import { beforeEach, expect, it, vi } from "vitest";
import { Webhook } from "svix";
const mock = vi.hoisted(() => ({ resolve: vi.fn(), reply: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ supportMessage: { findUnique: mock.find } }) }));
vi.mock("@/server/support-thread", () => ({ resolveCaseToken: mock.resolve, customerReply: mock.reply }));
import { POST } from "@/app/api/webhooks/resend/route";
const secret = "whsec_" + Buffer.from("fixture-signature-secret-32-bytes").toString("base64");
beforeEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function request(raw: string, valid = true) {
  const timestamp = new Date(); const id = "fixture-svix-message";
  return new Request("https://example.invalid/api/webhooks/resend", { method: "POST", body: raw, headers: { "svix-id": id, "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)), "svix-signature": valid ? new Webhook(secret).sign(id, timestamp, raw) : "v1,bad" } });
}
function enable() { vi.stubEnv("SUPPORT_INBOUND_ENABLED", "true"); vi.stubEnv("RESEND_WEBHOOK_SECRET", secret); vi.stubEnv("SUPPORT_RECEIVING_DOMAIN", "reply.example.invalid"); vi.stubEnv("RESEND_RECEIVING_API_KEY", "fixture-only"); }
it("receiving is disabled until its external configuration is explicitly enabled", async () => {
  vi.stubEnv("SUPPORT_INBOUND_ENABLED", "false");
  expect((await POST(request("{}"))).status).toBe(503);
  expect(mock.resolve).not.toHaveBeenCalled();
});
it("an invalid signature cannot read or append a case", async () => {
  enable(); expect((await POST(request("{}", false))).status).toBe(401);
  expect(mock.resolve).not.toHaveBeenCalled();
});
it("a signed notification retrieves the body and appends only to its verified case", async () => {
  enable(); mock.resolve.mockResolvedValue({ kind: "contact", id: "case", email: "fixture@audit.invalid" }); mock.find.mockResolvedValue(null);
  const fetcher = vi.fn(async () => Response.json({ text: "Gracias por la respuesta", headers: {} })); vi.stubGlobal("fetch", fetcher);
  const response = await POST(request(JSON.stringify({ type: "email.received", data: { email_id: "mail-fixture", from: "Fixture <fixture@audit.invalid>", to: ["token@reply.example.invalid"] } })));
  expect(response.status).toBe(200); expect(mock.reply).toHaveBeenCalledWith(expect.anything(), "contact", "case", "Gracias por la respuesta", "mail-fixture", "resend/mail-fixture");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("a sender mismatch never imports a message", async () => {
  enable(); mock.resolve.mockResolvedValue({ kind: "contact", id: "case", email: "owner@audit.invalid" });
  await POST(request(JSON.stringify({ type: "email.received", data: { email_id: "mail-fixture", from: "other@audit.invalid", to: ["token@reply.example.invalid"] } })));
  expect(mock.reply).not.toHaveBeenCalled();
});
