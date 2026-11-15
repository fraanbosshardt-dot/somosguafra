import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { replyToContact, replyToTicket } from "@/server/support-replies";
let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t?.stop(); });
it("la respuesta pública se conserva y el reintento no duplica el correo", async () => {
  const m = await t.db.contactMessage.create({ data: { code: "C-ABCDEF", area: "soporte", name: "Fixture", email: "reply@audit.invalid", subject: "Consulta", body: "Detalle" } });
  await Promise.all([replyToContact(t.db, m.id, "Respuesta útil", "https://example.invalid"), replyToContact(t.db, m.id, "Respuesta u\u0301til", "https://example.invalid")]);
  expect((await t.db.contactMessage.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("ANSWERED");
  expect(await t.db.emailOutbox.count({ where: { to: m.email } })).toBe(1);
  expect((await t.db.emailOutbox.findFirstOrThrow({ where: { to: m.email } })).sentAt).toBeNull();
});
it("la respuesta de Ayuda queda visible aunque el proveedor de correo esté caído", async () => {
  const u = await t.db.user.create({ data: { email: "help@audit.invalid", name: "Fixture", passwordHash: "x" } });
  const ticket = await t.db.supportTicket.create({ data: { userId: u.id, subject: "Ayuda", body: "Consulta", priority: "HIGH" } });
  await replyToTicket(t.db, ticket.id, "Ya lo revisamos", "https://example.invalid");
  expect((await t.db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).reply).toBe("Ya lo revisamos");
  expect(await t.db.emailOutbox.count({ where: { to: u.email, sentAt: null } })).toBe(1);
});
