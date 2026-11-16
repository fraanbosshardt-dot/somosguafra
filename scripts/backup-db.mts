// Encrypted read-only snapshot. Keep the encryption key separate from the backup storage.
import "dotenv/config";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import pg from "pg";
import { encryptBackup } from "../src/lib/backup";
import { readSnapshot } from "../src/server/backup-store";
// Validate the key before connecting to the database. Never fall back to plaintext.
encryptBackup({ version: 1, takenAt: "validation", tables: {} }, process.env.BACKUP_ENCRYPTION_KEY);
if (!process.env.DATABASE_URL) throw Error("Falta DATABASE_URL.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const snapshot = await readSnapshot(client);
  const encrypted = encryptBackup(snapshot, process.env.BACKUP_ENCRYPTION_KEY);
  mkdirSync(".data/backups", { recursive: true, mode: 0o700 });
  const file = `.data/backups/somosguafra-${new Date().toISOString().replace(/[:.]/g, "-")}.enc.json`;
  const temporary = file + ".tmp";
  writeFileSync(temporary, encrypted, { mode: 0o600, flag: "wx" });
  renameSync(temporary, file);
  console.log(`Copia cifrada guardada: ${file} · ${Object.keys(snapshot.tables).length} tablas`);
} finally { await client.end(); }
