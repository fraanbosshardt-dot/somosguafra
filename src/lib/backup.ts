import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

export type BackupSnapshot = { version: 1; takenAt: string; tables: Record<string, Record<string, unknown>[]> };
function keyFrom(value: string | undefined) {
  const key = Buffer.from(value ?? "", "base64");
  if (key.length !== 32 || key.toString("base64") !== value) throw Error("BACKUP_ENCRYPTION_KEY debe contener exactamente 32 bytes en base64. No se generó ninguna copia.");
  return key;
}
export function encryptBackup(snapshot: BackupSnapshot, secret: string | undefined) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const aad = Buffer.from("somosguafra-backup-v1"); cipher.setAAD(aad);
  const plain = Buffer.from(JSON.stringify(snapshot));
  if (plain.length > 256 * 1024 * 1024) throw Error("La copia supera el límite seguro de restauración. Usá el respaldo nativo del proveedor.");
  const ciphertext = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()]);
  return JSON.stringify({ version: 1, algorithm: "aes-256-gcm+gzip", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64") });
}
export function decryptBackup(envelope: string, secret: string | undefined): BackupSnapshot {
  const value = JSON.parse(envelope);
  if (value.version !== 1 || value.algorithm !== "aes-256-gcm+gzip") throw Error("Formato de copia no admitido.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(value.iv, "base64"));
  decipher.setAAD(Buffer.from("somosguafra-backup-v1")); decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const bytes = Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]);
  const snapshot = JSON.parse(gunzipSync(bytes, { maxOutputLength: 256 * 1024 * 1024 }).toString());
  if (snapshot.version !== 1 || !snapshot.tables || typeof snapshot.tables !== "object" || Array.isArray(snapshot.tables)) throw Error("Contenido de copia inválido.");
  return snapshot;
}
export function assertLocalRestore(connectionString: string | undefined) {
  const url = new URL(connectionString ?? "");
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw Error("La restauración automática solo permite una base local aislada.");
}
