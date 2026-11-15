import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { consumeRecoveryCode, replaceRecoveryCodes } from "@/server/recovery-codes";
let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t?.stop(); });
it("los códigos se guardan como hash, son de un solo uso y se invalidan al reemplazarlos", async () => {
  const user = await t.db.user.create({ data: { email: "codes@audit.invalid", name: "Fixture", passwordHash: "x", totpEnabledAt: new Date() } });
  const codes = await replaceRecoveryCodes(t.db, user.id);
  expect(codes).toHaveLength(8);
  expect(JSON.stringify(await t.db.recoveryCode.findMany())).not.toContain(codes[0]);
  const used = await Promise.all([consumeRecoveryCode(t.db, user.id, codes[0]), consumeRecoveryCode(t.db, user.id, codes[0])]);
  expect(used.filter(Boolean)).toHaveLength(1);
  expect(await consumeRecoveryCode(t.db, "another-user", codes[1])).toBe(false);
  await replaceRecoveryCodes(t.db, user.id);
  expect(await consumeRecoveryCode(t.db, user.id, codes[1])).toBe(false);
  expect(await consumeRecoveryCode(t.db, user.id, "invalid")).toBe(false);
});
