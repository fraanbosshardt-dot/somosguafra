import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { investmentsOverview } from "@/server/wealth";
vi.mock("@/server/quotes",async original=>({...await original<typeof import("@/server/quotes")>(),refreshQuotes:vi.fn(async()=>undefined)}));
let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async()=>{t=await startTestDb();},60000);
afterAll(async()=>{await t?.stop();});
it("precio manual usado por falta de conversión conserva su fecha y no anuncia variación de otro precio",async()=>{
 const ws=await t.db.workspace.create({data:{name:"Valoración de demostración",baseCurrency:"EUR"}});
 await t.db.quote.create({data:{source:"yahoo",symbol:"DEMO",price:"100",currency:"USD",changePct:"3",fetchedAt:new Date("2026-11-23")}});
 await t.db.investment.create({data:{workspaceId:ws.id,name:"Demo",kind:"Acción",currency:"EUR",ticker:"DEMO",assetClass:"US_STOCK",manualPrice:"90",manualPriceAt:new Date("2026-11-01")}});
 const item=(await investmentsOverview(t.db,ws.id))[0];
 expect(item.holding?.price?.toString()).toBe("90");expect(item.holding?.priceSource).toBe("manual");expect(item.holding?.changePct).toBeNull();expect(item.valuedAt?.toISOString().slice(0,10)).toBe("2026-11-01");
});
