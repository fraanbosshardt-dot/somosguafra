import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { unifiedInbox, pendingSupportCounts } from "@/server/support-inbox";
import { sendChatMessage, handoffChat, chatHash } from "@/server/guafra-chat";

let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t?.stop(); });
beforeEach(async () => {
  await t.db.chatSession.deleteMany(); await t.db.contactMessage.deleteMany();
  await t.db.supportTicket.deleteMany(); await t.db.user.deleteMany();
});
const site = (subject = "Formulario de prueba") => t.db.contactMessage.create({data:{
  code:`SG-${crypto.randomUUID()}`, subject, body:"Consulta ficticia", area:"pagos",
  name:"Cliente de prueba", email:"site@audit.invalid",
}});
async function chat(human: boolean) {
  const actor = {user:null,visitorHash:chatHash(crypto.randomUUID()),ip:null};
  const c = await sendChatMessage(t.db,actor,{text:"Cómo empezar",nonce:crypto.randomUUID()});
  if (human) await handoffChat(t.db,actor,c,{name:"Prueba",email:"chat@audit.invalid",area:"soporte"});
  return c;
}
it("separa formularios, chats derivados y bot sin duplicar un caso ni sus contadores",async()=>{
  const form=await site(), human=await chat(true), bot=await chat(false);
  const cases=await unifiedInbox(t.db,{scope:"chat",page:1});
  const forms=await unifiedInbox(t.db,{scope:"site",page:1});
  const automatic=await unifiedInbox(t.db,{scope:"chat",channel:"bot",page:1});
  expect(cases.rows.map(c=>c.code)).toEqual([human.code]);
  expect(cases.rows[0].source).toBe("chat");
  expect(forms.rows.map(c=>c.id)).toEqual([form.id]);
  expect(automatic.rows.map(c=>c.code)).toEqual([bot.code]);
  expect(await pendingSupportCounts(t.db)).toEqual({site:1,conversations:1});
  expect((await unifiedInbox(t.db,{scope:"site",channel:"bot",page:1})).total).toBe(0);
});
it("mantiene los casos históricos de Ayuda en conversaciones y cuenta solo pendientes del equipo",async()=>{
  const user=await t.db.user.create({data:{email:"legacy@audit.invalid",name:"Prueba",passwordHash:"fixture"}});
  await t.db.supportTicket.create({data:{userId:user.id,code:"SG-LEGACY",subject:"Ayuda anterior",body:"Prueba"}});
  const form=await site(); await chat(true);
  expect((await unifiedInbox(t.db,{scope:"chat",page:1})).total).toBe(2);
  await t.db.contactMessage.update({where:{id:form.id},data:{status:"ANSWERED"}});
  expect(await pendingSupportCounts(t.db)).toEqual({site:0,conversations:2});
  expect((await unifiedInbox(t.db,{scope:"site",status:"all",page:1})).total).toBe(1);
});
it("aplica búsqueda, asignación y motivo dentro de su propia bandeja",async()=>{
  const form=await site("Caso singular"), c=await chat(true);
  await t.db.contactMessage.update({where:{id:form.id},data:{assignedTo:"agent@audit.invalid"}});
  expect((await unifiedInbox(t.db,{scope:"site",query:"singular",assigned:"agent@audit.invalid",area:"pagos",page:1})).rows[0].id).toBe(form.id);
  expect((await unifiedInbox(t.db,{scope:"chat",query:form.code,page:1})).total).toBe(0);
  expect((await unifiedInbox(t.db,{scope:"site",query:c.code,page:1})).total).toBe(0);
  expect((await unifiedInbox(t.db,{scope:"site",query:"' OR 1=1 --",page:1})).total).toBe(0);
});
it("pagina muchas consultas sin perder registros ni repetirlos",async()=>{
  for(let i=0;i<28;i++) await site(`Consulta ${i}`);
  await chat(true);
  const first=await unifiedInbox(t.db,{scope:"site",page:1});
  const second=await unifiedInbox(t.db,{scope:"site",page:2});
  expect(first.total).toBe(28); expect(first.rows).toHaveLength(25); expect(second.rows).toHaveLength(3);
  expect(new Set([...first.rows,...second.rows].map(c=>c.id)).size).toBe(28);
});
