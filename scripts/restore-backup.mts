// Restore rehearsal only: local database with current migrations and no application rows.
import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";
import { assertLocalRestore, decryptBackup } from "../src/lib/backup";
import { restoreSnapshot } from "../src/server/backup-store";
assertLocalRestore(process.env.RESTORE_DATABASE_URL);
if (process.argv[2] !== "--empty-local" || !process.argv[3]) throw Error("Uso: npx tsx scripts/restore-backup.mts --empty-local <archivo.enc.json>. Requiere RESTORE_DATABASE_URL local y vacía.");
const snapshot = decryptBackup(readFileSync(process.argv[3], "utf8"), process.env.BACKUP_ENCRYPTION_KEY);
const client = new pg.Client({ connectionString: process.env.RESTORE_DATABASE_URL });
await client.connect();
try { const result = await restoreSnapshot(client, snapshot); console.log(`Restauración local verificada: ${result.tables} tablas, ${result.rows} filas.`); }
finally { await client.end(); }
