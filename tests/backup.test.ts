import { randomBytes } from "node:crypto";
import type pg from "pg";
import { expect, it } from "vitest";
import { assertLocalRestore, decryptBackup, encryptBackup } from "@/lib/backup";
import { readSnapshot, restoreSnapshot } from "@/server/backup-store";
import { createWorkspaceForUser } from "@/server/workspace";
import { startTestDb } from "./helpers/testdb";
it("encrypted backups authenticate content and key, never falling back to plaintext", () => {
  const key = randomBytes(32).toString("base64"), input = { version: 1 as const, takenAt: "fixture", tables: { User: [{ email: "private@audit.invalid" }] } };
  const encoded = encryptBackup(input, key);
  expect(encoded).not.toContain("private@audit.invalid");
  expect(decryptBackup(encoded, key)).toEqual(input);
  expect(() => decryptBackup(encoded, randomBytes(32).toString("base64"))).toThrow();
  const changed = JSON.parse(encoded); changed.tag = randomBytes(16).toString("base64");
  expect(() => decryptBackup(JSON.stringify(changed), key)).toThrow();
  expect(() => encryptBackup(input, "")).toThrow("BACKUP_ENCRYPTION_KEY");
  expect(() => assertLocalRestore("postgresql://fake:fake@production.invalid/db")).toThrow("local");
});
it("restores the complete encrypted snapshot to an empty local database and refuses to overwrite it", async () => {
  const source = await startTestDb(), target = await startTestDb();
  // Exercise real PostgreSQL semantics directly in PGlite; its socket fixture multiplexes only one client.
  const client = (db: typeof source) => ({ query: async (sql: string, values?: unknown[]) => {
    const r = await db.sql.query(sql, values); return { rows: r.rows, rowCount: r.rows.length };
  } }) as unknown as pg.Client;
  const reader = client(source), writer = client(target);
  try {
    const user = await source.db.user.create({ data: { email: "restore@audit.invalid", name: "Fixture", passwordHash: "fixture" } });
    const w = await createWorkspaceForUser(source.db, user.id);
    await source.db.appSetting.create({ data: { key: "restore-json", value: { arrays: [1, 2], text: "fixture" } } });
    await source.db.$disconnect();
    const key = randomBytes(32).toString("base64");
    const snapshot = decryptBackup(encryptBackup(await readSnapshot(reader), key), key);
    const result = await restoreSnapshot(writer, snapshot);
    expect(result.rows).toBeGreaterThan(30);
    expect((await writer.query('SELECT email FROM "User" WHERE id=$1', [user.id])).rows[0]).toMatchObject({ email: "restore@audit.invalid" });
    expect((await writer.query('SELECT "extraCurrencies" FROM "Workspace" WHERE id=$1', [w.id])).rows[0]).toMatchObject({ extraCurrencies: [] });
    expect((await writer.query('SELECT value FROM "AppSetting" WHERE key=$1', ["restore-json"])).rows[0].value).toEqual({ arrays: [1, 2], text: "fixture" });
    await expect(restoreSnapshot(writer, snapshot)).rejects.toThrow("contiene datos");
    expect(Number((await writer.query('SELECT COUNT(*) AS n FROM "User"')).rows[0].n)).toBe(1);
  } finally { await source.stop(); await target.stop(); }
});
