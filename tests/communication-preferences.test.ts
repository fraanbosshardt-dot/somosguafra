import {beforeAll,afterAll,expect,it} from "vitest";
import {startTestDb} from "./helpers/testdb";
import {saveCommunicationPreferences,unsubscribeOptionalEmail} from "@/server/communication-preferences";
import {unsubscribeIdentity,unsubscribeToken} from "@/lib/communication-preferences";
let t: Awaited<ReturnType<typeof startTestDb>>, id:string;
beforeAll(async()=>{t=await startTestDb();id=(await t.db.user.create({data:{email:"prefs@audit.invalid",name:"Demo",passwordHash:"fixture"}})).id;},60_000);
afterAll(async()=>t?.stop());
it("no convierte cuentas existentes en suscriptoras y guarda solo elecciones expresas",async()=>{
 expect(await t.db.communicationPreference.findUnique({where:{userId:id}})).toBeNull();
 await saveCommunicationPreferences(t.db,id,{tips:true,news:false,offers:false});
 expect(await t.db.communicationPreference.findUnique({where:{userId:id}})).toMatchObject({tips:true,news:false,offers:false,consentVersion:"2026-11-24"});
 expect(await t.db.auditLog.count({where:{userId:id,action:"communications.preferences"}})).toBe(1);
});
it("la baja suprime opcionales pendientes y conserva los avisos de pagos",async()=>{
 await t.db.emailOutbox.createMany({data:[{dedupeKey:"marketing/test",to:"prefs@audit.invalid",purpose:"marketing",subject:"Demo",text:"Demo"},{dedupeKey:"billing/test",to:"prefs@audit.invalid",purpose:"billing",subject:"Servicio",text:"Demo"}]});
 await unsubscribeOptionalEmail(t.db,id);
 expect(await t.db.communicationPreference.findUnique({where:{userId:id}})).toMatchObject({tips:false,news:false,offers:false});
 expect((await t.db.emailOutbox.findUniqueOrThrow({where:{dedupeKey:"marketing/test"}})).deliveryState).toBe("suppressed");
 expect((await t.db.emailOutbox.findUniqueOrThrow({where:{dedupeKey:"billing/test"}})).deliveryState).toBe("queued");
});
it("el enlace firmado solo permite la baja de su destinatario",()=>{
 const secret="fixture-secret-more-than-thirty-two-characters";
 const token=unsubscribeToken(id,secret);
 expect(unsubscribeIdentity(token,secret)).toBe(id);
 expect(unsubscribeIdentity(token+"x",secret)).toBeNull();
 expect(unsubscribeIdentity(token.replace(id,"another-user"),secret)).toBeNull();
 expect(unsubscribeIdentity(token,"a-different-secret-more-than-32-characters")).toBeNull();
});
