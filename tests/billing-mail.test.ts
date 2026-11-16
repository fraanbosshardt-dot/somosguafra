import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { sendBillingNotice, drainEmailOutbox } from "@/server/billing-mail";
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendEmail: send, appUrl: () => "https://somosguafra.com" }));
let t: Awaited<ReturnType<typeof startTestDb>>, ws: string;
beforeAll(async () => {
  t = await startTestDb();
  const user = await t.db.user.create({ data: { email: "billing@example.com", name: "Ana", passwordHash: "" } });
  ws = (await createWorkspaceForUser(t.db, user.id)).id;
  for (const [id, status] of [["1", "approved"], ["2", "rejected"]]) await t.db.invoice.create({ data: { workspaceId: ws, provider: "mercadopago", providerRef: id, amount: 7499, currency: "ARS", status } });
});
afterAll(async () => { await t.stop(); });
afterEach(() => { vi.unstubAllEnvs(); send.mockReset(); });
describe("avisos de suscripción", () => {
  it("envía una sola vez el mismo resultado de pago", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key"); send.mockResolvedValue({ sent: true });
    await sendBillingNotice(t.db, ws, "payment-1-approved", "Pago aprobado", "Pro renovado.");
    await sendBillingNotice(t.db, ws, "payment-1-approved", "Pago aprobado", "Pro renovado.");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ purpose: "billing", to: "billing@example.com", idempotencyKey: `billing/${ws}/payment-1-approved` });
  });
  it("un error del proveedor permite reintentar sin dar el correo por enviado", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key"); send.mockResolvedValueOnce({ sent: false, reason: "http-500" }).mockResolvedValueOnce({ sent: true });
    await expect(sendBillingNotice(t.db, ws, "payment-2-rejected", "Pago rechazado", "Revisá el pago.")).resolves.toBeUndefined();
    expect(await t.db.auditLog.count({ where: { entityId: "payment-2-rejected" } })).toBe(0);
    const pending = await t.db.emailOutbox.findUniqueOrThrow({ where: { dedupeKey: `billing/${ws}/payment-2-rejected` } });
    expect(pending.sentAt).toBeNull(); expect(pending.lastError).toBe("http-500");
    await t.db.emailOutbox.update({ where: { id: pending.id }, data: { nextAttemptAt: new Date(0) } });
    await drainEmailOutbox(t.db);
    expect(send).toHaveBeenCalledTimes(2);
    expect((await t.db.emailOutbox.findUniqueOrThrow({ where: { id: pending.id } })).sentAt).not.toBeNull();
  });
  it("no envía al destinatario anterior cuando cambia el titular de correo", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await sendBillingNotice(t.db, ws, "recipient-change", "Aviso", "Estado del plan.");
    const member = await t.db.membership.findFirstOrThrow({ where: { workspaceId: ws, role: "OWNER" } });
    await t.db.user.update({ where: { id: member.userId }, data: { email: "new-owner@example.com" } });
    vi.stubEnv("RESEND_API_KEY", "test-key");
    await drainEmailOutbox(t.db);
    expect(send).not.toHaveBeenCalled();
    const row = await t.db.emailOutbox.findUniqueOrThrow({ where: { dedupeKey: `billing/${ws}/recipient-change` } });
    expect(row.deliveryState).toBe("suppressed"); expect(row.sentAt).toBeNull();
    await t.db.user.update({ where: { id: member.userId }, data: { email: "billing@example.com" } });
  });
  it("un aviso de pago rechazado ya superado se suprime sin fingir entrega", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await sendBillingNotice(t.db, ws, "payment-2-rejected", "Rechazado", "Estado anterior.");
    // Otra transición genera su propia clave; construir aquí una cola no enviada.
    await t.db.emailOutbox.update({ where: { dedupeKey: `billing/${ws}/payment-2-rejected` }, data: { sentAt: null, deliveryState: "queued", firstAttemptAt: null, attempts: 0, nextAttemptAt: new Date(0) } });
    await t.db.invoice.update({ where: { providerRef: "2" }, data: { status: "approved" } });
    vi.stubEnv("RESEND_API_KEY", "test-key");
    await drainEmailOutbox(t.db);
    expect(send).not.toHaveBeenCalled();
    expect((await t.db.emailOutbox.findUniqueOrThrow({ where: { dedupeKey: `billing/${ws}/payment-2-rejected` } })).deliveryState).toBe("suppressed");
  });
  it("una entrega incierta fuera de la ventana no se reenvía automáticamente", async () => {
    await t.db.emailOutbox.create({ data: { dedupeKey: "audit/uncertain", to: "fixture@example.com", subject: "Fixture", text: "Fixture", purpose: "support", attempts: 1, firstAttemptAt: new Date(Date.now() - 25 * 3600_000), nextAttemptAt: new Date(0) } });
    vi.stubEnv("RESEND_API_KEY", "test-key");
    await drainEmailOutbox(t.db); await drainEmailOutbox(t.db);
    expect(send).not.toHaveBeenCalled();
    const row = await t.db.emailOutbox.findUniqueOrThrow({ where: { dedupeKey: "audit/uncertain" } });
    expect(row.deliveryState).toBe("uncertain"); expect(row.sentAt).toBeNull();
  });
});
