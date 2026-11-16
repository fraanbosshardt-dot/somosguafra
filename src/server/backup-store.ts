import type pg from "pg";
import type { BackupSnapshot } from "@/lib/backup";
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function readSnapshot(client: pg.Client): Promise<BackupSnapshot> {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const { rows } = await client.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
    const tables: BackupSnapshot["tables"] = {};
    for (const { table_name } of rows) tables[table_name] = (await client.query(`SELECT * FROM ${ident(table_name)}`)).rows;
    await client.query("COMMIT");
    return { version: 1, takenAt: new Date().toISOString(), tables };
  } catch (e) { await client.query("ROLLBACK"); throw e; }
}

// No TRUNCATE, DROP or overwriting rows. Deferred checks are restored inside the same transaction.
export async function restoreSnapshot(client: pg.Client, snapshot: BackupSnapshot) {
  await client.query("BEGIN");
  try {
    const schema = (await client.query<{ table_name: string; column_name: string; data_type: string }>("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'")).rows;
    const tables = [...new Set(schema.map(c => c.table_name))].filter(t => t !== "_prisma_migrations");
    const savedTables = Object.keys(snapshot.tables).filter(t => t !== "_prisma_migrations");
    if (tables.length !== savedTables.length || tables.some(t => !savedTables.includes(t))) throw Error("La estructura de la copia no coincide con las migraciones del destino.");
    // Lock before emptiness check so another process cannot populate the target during this rehearsal.
    await client.query(`LOCK TABLE ${tables.map(ident).join(",")} IN ACCESS EXCLUSIVE MODE`);
    for (const table of tables) {
      // This key is bootstrapped by migrations even in a fresh database. No user settings may be overwritten.
      const filter = table === "AppSetting" ? " WHERE key <> 'analyticsStartedAt'" : "";
      if ((await client.query(`SELECT 1 FROM ${ident(table)}${filter} LIMIT 1`)).rows.length) throw Error("El destino contiene datos. No se restauró ni sobrescribió nada.");
    }
    const constraints = (await client.query<{ name: string; table: string; deferred: boolean }>(`SELECT c.conname AS name,t.relname AS table,c.condeferrable AS deferred FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.contype='f' AND n.nspname='public'`)).rows;
    for (const c of constraints) if (!c.deferred) await client.query(`ALTER TABLE ${ident(c.table)} ALTER CONSTRAINT ${ident(c.name)} DEFERRABLE INITIALLY IMMEDIATE`);
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    let count = 0;
    for (const table of tables) {
      const columns = schema.filter(c => c.table_name === table);
      for (const row of snapshot.tables[table]) {
        const names = Object.keys(row);
        if (names.some(name => !columns.some(c => c.column_name === name))) throw Error("La copia contiene columnas que no existen en el destino.");
        const values = names.map(name => {
          const v = row[name], type = columns.find(c => c.column_name === name)!.data_type;
          return v !== null && (type === "json" || type === "jsonb") ? JSON.stringify(v) : v;
        });
        const bootstrap = table === "AppSetting" && row.key === "analyticsStartedAt"
          ? ' ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,"updatedAt"=EXCLUDED."updatedAt"' : "";
        await client.query(`INSERT INTO ${ident(table)} (${names.map(ident).join(",")}) VALUES (${names.map((_, i) => "$" + (i + 1)).join(",")})${bootstrap}`, values);
        count++;
      }
    }
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    for (const c of constraints) if (!c.deferred) await client.query(`ALTER TABLE ${ident(c.table)} ALTER CONSTRAINT ${ident(c.name)} NOT DEFERRABLE`);
    for (const table of tables) {
      const actual = Number((await client.query(`SELECT COUNT(*) AS n FROM ${ident(table)}`)).rows[0].n);
      if (actual !== snapshot.tables[table].length) throw Error("No coincide la cantidad de filas restauradas.");
    }
    await client.query("COMMIT"); return { tables: tables.length, rows: count };
  } catch (e) { await client.query("ROLLBACK"); throw e; }
}
