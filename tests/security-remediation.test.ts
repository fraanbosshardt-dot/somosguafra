import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { authBuckets, reserveSecurityAttempt } from "@/server/security-limits";
import { createUserWithWorkspace, ensureUserWorkspace } from "@/server/workspace";
import { exportAccountData } from "@/server/admin-accounts";
import { checkVerifyCode, verifyCode } from "@/server/email-verify";
import { verifyToken } from "@/server/account-mail";
import { caseToken } from "@/server/support-thread";
import { encryptSecret } from "@/lib/crypto";
import { totpAt } from "@/lib/auth/totp";
import { consumeTotp } from "@/server/totp-check";

let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); }, 60_000);
afterAll(async () => { await t.stop(); });
afterEach(() => vi.unstubAllEnvs());

it("reserva cuotas concurrentes sin permitir superar el límite", async () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const attempts = await Promise.all(Array.from({ length: 12 }, () => reserveSecurityAttempt(t.db, "regression", authBuckets("same@example.invalid", "127.0.0.1", 5, 20), now)));
  expect(attempts.filter(Boolean)).toHaveLength(5);
  expect(await reserveSecurityAttempt(t.db, "regression", authBuckets("same@example.invalid", "127.0.0.1", 5, 20), new Date(now.getTime() + 16 * 60_000))).toBe(true);
  const log = await t.db.auditLog.findFirstOrThrow({ where: { action: "security.rate.regression" } });
  expect(log.entityId).not.toContain("example.invalid");
});

it("aplica el límite por conexión aunque cambie el correo", async () => {
  const now = new Date();
  expect(await reserveSecurityAttempt(t.db, "ip-test", authBuckets("one", "same-ip", 3, 1), now)).toBe(true);
  expect(await reserveSecurityAttempt(t.db, "ip-test", authBuckets("two", "same-ip", 3, 1), now)).toBe(false);
  expect(await t.db.auditLog.count({ where: { action: "security.rate.ip-test" } })).toBe(2);
});

it("un código TOTP no puede usarse dos veces desde solicitudes concurrentes", async () => {
  vi.stubEnv("AUTH_SECRET", "test-totp-secret-at-least-32-characters");
  const secret = "JBSWY3DPEHPK3PXP", now = Date.UTC(2026, 10, 16, 12);
  const u = await t.db.user.create({ data: { email: "totp-replay@example.invalid", name: "Fixture", passwordHash: "", totpSecretEnc: encryptSecret(secret), totpEnabledAt: new Date() } });
  const code = totpAt(secret, now);
  expect((await Promise.all([consumeTotp(t.db, u.id, code, now), consumeTotp(t.db, u.id, code, now)])).filter(Boolean)).toHaveLength(1);
  expect(await consumeTotp(t.db, u.id, code, now + 30_000)).toBe(false);
  expect(await consumeTotp(t.db, u.id, totpAt(secret, now + 30_000), now + 30_000)).toBe(true);
  const events = await t.db.auditLog.findMany({ where: { userId: u.id, action: "auth.totp_consumed" } });
  expect(JSON.stringify(events)).not.toContain(secret);
});

it.each([undefined, "short"])("no firma verificaciones con secreto insuficiente: %s", value => {
  vi.stubEnv("AUTH_SECRET", value);
  expect(() => verifyCode("u", "x@example.invalid")).toThrow(/AUTH_SECRET/);
  expect(() => checkVerifyCode("u", "x@example.invalid", "000000")).toThrow(/AUTH_SECRET/);
  expect(() => verifyToken("u", "x@example.invalid")).toThrow(/AUTH_SECRET/);
  expect(caseToken("contact", "id", "x@example.invalid")).toBeNull();
});

it("revierte usuario, membresía y espacio si falla una categoría del alta", async () => {
  // Inyección local controlada: solo nuestra base efímera, nunca producción.
  await t.db.$executeRawUnsafe(`CREATE FUNCTION fail_signup_category() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture signup failure'; END $$`);
  await t.db.$executeRawUnsafe(`CREATE TRIGGER fail_signup BEFORE INSERT ON "Category" FOR EACH ROW EXECUTE FUNCTION fail_signup_category()`);
  try {
    await expect(createUserWithWorkspace(t.db, { email: "rollback@example.invalid", name: "Fixture", passwordHash: "" })).rejects.toThrow();
    expect(await t.db.user.count({ where: { email: "rollback@example.invalid" } })).toBe(0);
    expect(await t.db.workspace.count()).toBe(0);
  } finally {
    await t.db.$executeRawUnsafe(`DROP TRIGGER fail_signup ON "Category"`);
    await t.db.$executeRawUnsafe(`DROP FUNCTION fail_signup_category()`);
  }
});

it("repara una alta antigua incompleta una sola vez incluso con concurrencia", async () => {
  const u = await t.db.user.create({ data: { email: "orphan@example.invalid", name: "Fixture", passwordHash: "" } });
  await Promise.all([ensureUserWorkspace(t.db, u.id), ensureUserWorkspace(t.db, u.id)]);
  expect(await t.db.membership.count({ where: { userId: u.id, role: "OWNER" } })).toBe(1);
});

it("exporta respuestas públicas y restringe facturación a dueños", async () => {
  const owner = await createUserWithWorkspace(t.db, { email: "export-owner@example.invalid", name: "Owner", passwordHash: "" });
  const guest = await createUserWithWorkspace(t.db, { email: "export-guest@example.invalid", name: "Guest", passwordHash: "" });
  await t.db.membership.create({ data: { userId: guest.user.id, workspaceId: owner.workspace.id, role: "VIEWER" } });
  const ticket = await t.db.supportTicket.create({ data: { userId: guest.user.id, subject: "Fixture", body: "Consulta" } });
  await t.db.supportMessage.createMany({ data: [
    { ticketId: ticket.id, role: "staff", body: "Respuesta pública", dedupeKey: "public-regression" },
    { ticketId: ticket.id, role: "staff", body: "Nota interna confidencial", internal: true, dedupeKey: "private-regression" },
  ] });
  const data = await exportAccountData(t.db, guest.user.id);
  const shared = data.spaces.find(s => s.workspace?.id === owner.workspace.id)!;
  expect(shared.subscription).toBeUndefined(); expect(shared.invoices).toBeUndefined();
  expect(data.spaces.find(s => s.workspace?.id === guest.workspace.id)?.subscription).toBeDefined();
  expect(data.supportTickets[0].messages.map(m => m.body)).toEqual(["Respuesta pública"]);
  expect(JSON.stringify(data)).not.toContain("Nota interna confidencial");
});
