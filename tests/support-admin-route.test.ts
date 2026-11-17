import {beforeAll,afterAll,beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {startTestDb} from "./helpers/testdb";
const state=vi.hoisted(()=>({admin:null as any,db:null as any}));
vi.mock("@/lib/auth/admin",()=>({getAdmin:async()=>state.admin}));
vi.mock("@/lib/db",()=>({getDb:()=>state.db}));
import {GET,POST} from "@/app/admin/api/soporte/route";
let t:Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async()=>{t=await startTestDb();state.db=t.db;vi.stubEnv("APP_URL","https://example.invalid");});
beforeEach(()=>{state.admin=null;});
afterAll(async()=>{vi.unstubAllEnvs();await t?.stop();});
const req=(data:unknown,origin="https://example.invalid")=>new NextRequest("https://example.invalid/admin/api/soporte",{method:"POST",headers:{origin,"content-type":"application/json"},body:typeof data==="string"?data:JSON.stringify(data)});
it("rechaza sesiones ausentes y roles sin atención",async()=>{
  expect((await GET()).status).toBe(401);expect((await POST(req({}))).status).toBe(401);
  state.admin={email:"viewer@audit.invalid",sessionId:"viewer",role:"VIEWER"};
  expect((await GET()).status).toBe(403);expect((await POST(req({}))).status).toBe(403);
});
it("valida origen y tamaño y no acepta permisos del navegador",async()=>{
  state.admin={email:"agent@audit.invalid",sessionId:"agent",role:"SUPPORT"};
  expect((await POST(req({},"https://attacker.invalid"))).status).toBe(403);
  expect((await POST(req({},""))).status).toBe(403);
  expect((await POST(req("broken"))).status).toBe(400);
  expect((await POST(req({text:"x".repeat(2200)}))).status).toBe(413);
  const c=await t.db.contactMessage.create({data:{code:"API-FIXTURE",area:"soporte",name:"Fixture",email:"client@audit.invalid",subject:"Demo",body:"Private",assignedTo:"boss@audit.invalid"}});
  expect((await POST(req({action:"claim",kind:"contact",id:c.id,token:crypto.randomUUID(),revision:c.updatedAt.toISOString(),role:"OWNER",email:"boss@audit.invalid"}))).status).toBe(409);
  expect(await t.db.supportReplyLease.count()).toBe(0);
});
it("cuenta únicamente los avisos del integrante autenticado y no expone su contenido",async()=>{
  const c=await t.db.contactMessage.findUniqueOrThrow({where:{code:"API-FIXTURE"}});
  for(const recipient of ["agent@audit.invalid","boss@audit.invalid"])await t.db.adminSupportNotice.create({data:{eventKey:recipient,recipient,kind:"contact",caseId:c.id,contactId:c.id,code:c.code,type:"NEW",activityAt:new Date()}});
  state.admin={email:"agent@audit.invalid",sessionId:"agent",role:"SUPPORT"};
  const response=await GET();expect(response.headers.get("cache-control")).toContain("no-store");expect(await response.json()).toEqual({unread:1});
});
