import type { Db } from "./ledger";
// INSERT ... ON CONFLICT DO NOTHING: layout y página pueden registrar el mismo día en paralelo.
export async function recordProductActivity(db: Pick<Db, "productActivity">, userId: string, now = new Date()) {
  const label = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const day = new Date(`${label}T00:00:00Z`);
  return db.productActivity.createMany({ data: [{ userId, day }], skipDuplicates: true });
}
