import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { PrismaClient, User } from "@/generated/prisma/client";
import { startTestDb } from "./helpers/testdb";
import { encryptSecret } from "@/lib/crypto";
import { totpAt } from "@/lib/auth/totp";

const state = vi.hoisted(() => ({ db: undefined as PrismaClient | undefined, user: undefined as User | undefined, createdAt: new Date(), sessionId: "fixture-session" }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ user: state.user, session: { id: state.sessionId, createdAt: state.createdAt } }), audit: async (action: string) => state.db!.auditLog.create({ data: { userId: state.user!.id, action } }), requireWritableWorkspace: vi.fn(), canUse: vi.fn() }));
import { confirm2faAction, disable2faAction, twoFactorQr } from "@/app/actions/app";

let t: Awaited<ReturnType<typeof startTestDb>>;
const secret = "JBSWY3DPEHPK3PXP";
beforeAll(async () => {
  vi.stubEnv("AUTH_SECRET", "test-security-action-secret-at-least-32-characters");
  t = await startTestDb(); state.db = t.db;
  state.user = await t.db.user.create({ data: { email: "totp-limit@example.invalid", name: "Fixture", passwordHash: "", totpSecretEnc: encryptSecret(secret), totpEnabledAt: new Date() } });
}, 60_000);
afterAll(async () => { await t.stop(); vi.unstubAllEnvs(); });

it("una sesión antigua no obtiene el secreto QR ni puede completar una activación", async () => {
  const previous = state.user, createdAt = state.createdAt;
  state.user = { ...previous!, totpEnabledAt: null };
  state.createdAt = new Date(Date.now() - 16 * 60_000);
  try {
    expect(await twoFactorQr()).toBeNull();
    const fd = new FormData(); fd.set("code", totpAt(secret, Date.now()));
    expect((await confirm2faAction(null, fd))?.error).toMatch(/ingresá de nuevo/);
  } finally { state.user = previous; state.createdAt = createdAt; }
});

it("no desactiva 2FA desde una sesión antigua aunque el código sea correcto", async () => {
  state.createdAt = new Date(Date.now() - 16 * 60_000);
  const fd = new FormData(); fd.set("code", totpAt(secret, Date.now()));
  expect((await disable2faAction(null, fd))?.error).toMatch(/ingresá de nuevo/);
  expect((await t.db.user.findUniqueOrThrow({ where: { id: state.user!.id } })).totpEnabledAt).not.toBeNull();
});

it("registra fallos y bloquea el sexto intento de quitar 2FA", async () => {
  state.createdAt = new Date();
  const fd = new FormData(); fd.set("code", "invalid");
  const replies = await Promise.all(Array.from({ length: 6 }, () => disable2faAction(null, fd)));
  expect(replies.filter(r => r?.error?.includes("Demasiados intentos"))).toHaveLength(1);
  expect(await t.db.auditLog.count({ where: { action: "auth.2fa_failed", userId: state.user!.id } })).toBe(5);
  expect((await t.db.user.findUniqueOrThrow({ where: { id: state.user!.id } })).totpEnabledAt).not.toBeNull();
});

it("activar 2FA revoca sesiones anteriores que nunca completaron el segundo factor", async () => {
  state.user = await t.db.user.create({ data: { email: "totp-enable@example.invalid", name: "Fixture", passwordHash: "", totpSecretEnc: encryptSecret(secret) } });
  const current = await t.db.session.create({ data: { userId: state.user.id, tokenHash: "current", twoFactorVerified: true, expiresAt: new Date(Date.now() + 3600_000) } });
  await t.db.session.create({ data: { userId: state.user.id, tokenHash: "old", twoFactorVerified: true, expiresAt: new Date(Date.now() + 3600_000) } });
  state.sessionId = current.id;
  const fd = new FormData(); fd.set("code", totpAt(secret, Date.now()));
  expect((await confirm2faAction(null, fd))?.ok).toMatch(/activada/);
  expect(await t.db.session.count({ where: { userId: state.user.id } })).toBe(1);
  expect((await t.db.session.findUniqueOrThrow({ where: { id: current.id } })).twoFactorVerified).toBe(true);
});
