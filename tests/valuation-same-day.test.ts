// Actualizar el valor dos veces el mismo día: queda el último (antes quedaban dos y se mostraba cualquiera).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { addValuation, assetsOverview, investmentsOverview } from "@/server/wealth";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "val@test.com", name: "Val", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("valuación del mismo día", () => {
  it("en una inversión, la segunda del día reemplaza a la primera", async () => {
    const inv = await db.investment.create({ data: { workspaceId: ws, name: "Plazo fijo", kind: "Plazo fijo", currency: "ARS" } });
    await addValuation(db, ws, { investmentId: inv.id, value: "300000", date: d("2026-11-20") });
    await addValuation(db, ws, { investmentId: inv.id, value: "305000", date: d("2026-11-24") });
    await addValuation(db, ws, { investmentId: inv.id, value: "310000", date: d("2026-11-24") });
    const o = (await investmentsOverview(db, ws)).find((x) => x.inv.id === inv.id)!;
    expect(o.value.toNumber()).toBe(310000);
    expect(await db.valuation.count({ where: { investmentId: inv.id } })).toBe(2);
  });

  it("en un bien, también", async () => {
    const as = await db.asset.create({ data: { workspaceId: ws, name: "Auto", kind: "Vehículo", currency: "ARS" } });
    await addValuation(db, ws, { assetId: as.id, value: "9000000", date: d("2026-11-24") });
    await addValuation(db, ws, { assetId: as.id, value: "9500000", date: d("2026-11-24") });
    const a = (await assetsOverview(db, ws)).find((x) => x.asset.id === as.id)!;
    expect(a.value.toNumber()).toBe(9500000);
  });
});
