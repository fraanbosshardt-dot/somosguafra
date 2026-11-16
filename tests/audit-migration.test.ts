import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
it("migrates existing delivery outcomes without calling a suppressed message delivered or replaying an old unknown send", async () => {
  const pg = await PGlite.create();
  try {
    const dir = join(process.cwd(), "prisma/migrations"), current = "20261116010000_audit_reliability";
    for (const name of readdirSync(dir).filter(n => /^\d+_/.test(n) && n < current).sort()) await pg.exec(readFileSync(join(dir, name, "migration.sql"), "utf8"));
    await pg.exec(`INSERT INTO "EmailOutbox" (id,"dedupeKey","to",subject,text,purpose,"sentAt","lastError",attempts,"createdAt") VALUES
      ('sent','fixture/sent','fixture@audit.invalid','Fixture','Fixture','billing',CURRENT_TIMESTAMP,NULL,1,CURRENT_TIMESTAMP),
      ('suppressed','fixture/suppressed','fixture@audit.invalid','Fixture','Fixture','billing',CURRENT_TIMESTAMP,'suppressed-state-changed',1,CURRENT_TIMESTAMP),
      ('unknown','fixture/unknown','fixture@audit.invalid','Fixture','Fixture','billing',NULL,'red',1,CURRENT_TIMESTAMP-INTERVAL '2 days')`);
    await pg.exec(readFileSync(join(dir, current, "migration.sql"), "utf8"));
    const rows = (await pg.query<{ id: string; deliveryState: string; sentAt: Date | null; firstAttemptAt: Date | null }>('SELECT id,"deliveryState","sentAt","firstAttemptAt" FROM "EmailOutbox" ORDER BY id')).rows;
    expect(rows.find(r => r.id === "sent")).toMatchObject({ deliveryState: "sent", sentAt: expect.any(Date) });
    expect(rows.find(r => r.id === "suppressed")).toMatchObject({ deliveryState: "suppressed", sentAt: null });
    expect(rows.find(r => r.id === "unknown")?.deliveryState).toBe("uncertain");
    expect(rows.find(r => r.id === "unknown")?.firstAttemptAt!.getTime()).toBeLessThan(Date.now() - 24 * 3600_000);
  } finally { await pg.close(); }
});
