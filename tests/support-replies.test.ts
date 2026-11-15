import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { replyToContact, replyToTicket } from "@/server/support-replies";
import { caseToken, resolveCaseToken, customerReply } from "@/server/support-thread";
let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { vi.unstubAllEnvs(); await t?.stop(); });
it("la respuesta pública se conserva y el reintento no duplica el correo", async () => {
  const m = await t.db.contactMessage.create({ data: { code: "C-ABCDEF", area: "soporte", name: "Fixture", email: "reply@audit.invalid", subject: "Consulta", body: "Detalle" } });
  await Promise.all([replyToContact(t.db, m.id, "Respuesta útil", "https://example.invalid"), replyToContact(t.db, m.id, "Respuesta u\u0301til", "https://example.invalid")]);
  expect((await t.db.contactMessage.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("ANSWERED");
  expect(await t.db.emailOutbox.count({ where: { to: m.email } })).toBe(1);
  expect((await t.db.emailOutbox.findFirstOrThrow({ where: { to: m.email } })).sentAt).toBeNull();
});
it("el enlace privado está firmado, vence y un mensaje reabre solo su propio caso", async () => {
  vi.stubEnv("AUTH_SECRET", "test-support-auth-secret-long-enough");
  const c = await t.db.contactMessage.create({ data: { code: "C-SIGNED", area: "soporte", name: "Fixture", email: "signed@audit.invalid", subject: "Caso privado", body: "Inicial", status: "CLOSED" } });
  const token = caseToken("contact", c.id, c.email)!;
  expect(token.length).toBeLessThanOrEqual(64);
  expect((await resolveCaseToken(t.db, token))?.id).toBe(c.id);
  expect(await resolveCaseToken(t.db, token + "x")).toBeNull();
  expect(await resolveCaseToken(t.db, caseToken("contact", c.id, c.email, 1)!)).toBeNull();
  await customerReply(t.db, "contact", c.id, "Tengo otra pregunta", "nonce-fixture-123");
  await customerReply(t.db, "contact", c.id, "Tengo otra pregunta", "nonce-fixture-123");
  expect(await t.db.supportMessage.count({ where: { contactId: c.id } })).toBe(1);
  expect((await t.db.contactMessage.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("OPEN");
  await replyToContact(t.db, c.id, "Lo revisamos", "https://example.invalid");
  await customerReply(t.db, "contact", c.id, "Gracias, otra consulta", "nonce-fixture-456");
  await replyToContact(t.db, c.id, "Lo revisamos", "https://example.invalid");
  expect(await t.db.emailOutbox.count({ where: { to: c.email } })).toBe(2);
});
it("la respuesta de Ayuda queda visible aunque el proveedor de correo esté caído", async () => {
  const u = await t.db.user.create({ data: { email: "help@audit.invalid", name: "Fixture", passwordHash: "x" } });
  const ticket = await t.db.supportTicket.create({ data: { userId: u.id, subject: "Ayuda", body: "Consulta", priority: "HIGH" } });
  await replyToTicket(t.db, ticket.id, "Ya lo revisamos", "https://example.invalid");
  expect((await t.db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).reply).toBe("Ya lo revisamos");
  expect(await t.db.emailOutbox.count({ where: { to: u.email, sentAt: null } })).toBe(1);
});
