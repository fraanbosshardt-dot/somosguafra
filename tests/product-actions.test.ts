import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount } from "@/server/ledger";
import { saveExperience } from "@/server/experience";
import { experienceFrom } from "@/lib/experience";
import type { PrismaClient } from "@/generated/prisma/client";
const state=vi.hoisted(()=>({db:undefined as PrismaClient|undefined,actor:null as unknown,plan:"FREE",readOnly:false}));
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(to:string)=>{throw new Error(`REDIRECT:${to}`);}}));
vi.mock("@/lib/db",()=>({getDb:()=>state.db}));
vi.mock("@/lib/auth/session",()=>({requireWritableWorkspace:async()=>{if(state.readOnly)throw new Error("READ_ONLY");return state.actor;},requireUser:vi.fn(),canUse:async()=>state.plan==="PRO",audit:vi.fn()}));
import { saveModulesAction, createMovementAction } from "@/app/actions/app";
import { experienceAction } from "@/app/app/movimientos/preferencias/actions";
import { reviewFile } from "@/app/app/importar/actions";
import { importAction } from "@/app/actions/modules";
let t:Awaited<ReturnType<typeof startTestDb>>;
let bankId="", ws="", categoryId="";
beforeAll(async()=>{
 t=await startTestDb();state.db=t.db;
 const user=await t.db.user.create({data:{name:"Prueba",email:"product-actions@audit.invalid",passwordHash:"fixture"}});
 const workspace=await createWorkspaceForUser(t.db,user.id);ws=workspace.id;
 const bank=await createAccount(t.db,ws,{name:"Banco",type:"SAVINGS",currency:"ARS",initialBalance:"1000",initialDate:new Date("2026-11-01")});bankId=bank.id;
 categoryId=(await t.db.category.findFirstOrThrow({where:{workspaceId:ws,kind:"EXPENSE"}})).id;
 state.actor={workspace,user,membership:{role:"OWNER"},plan:"FREE"};
},60000);
afterAll(async()=>{await t?.stop();});
it("cambiar funciones desde una pantalla anterior preserva favoritos guardados después",async()=>{
 await saveExperience(t.db,ws,"favorite",{name:"Mercado",kind:"EXPENSE",accountId:bankId,categoryId});
 const fd=new FormData();fd.append("modules","flujo");await saveModulesAction(null,fd);
 const space=await t.db.workspace.findUniqueOrThrow({where:{id:ws}});
 expect(experienceFrom(space.modules).favorites[0].name).toBe("Mercado");expect(space.modules).toMatchObject({flujo:true,presupuestos:false});
});
it("rol de lectura no puede guardar favoritos ni iniciar una revisión de archivo",async()=>{
 state.readOnly=true;
 try {await expect(experienceAction(null,new FormData())).rejects.toThrow("READ_ONLY");await expect(reviewFile(new FormData())).rejects.toThrow("READ_ONLY");}finally{state.readOnly=false;}
});
function csvForm(){const fd=new FormData();fd.set("accountId",bankId);fd.set("file",new File(["Fecha,Concepto,Importe\n23/11/2026,Compra,-40\n"],"demo.csv",{type:"text/csv"}));return fd;}
it("confirmar importación sin revisar no escribe registros",async()=>{
 const fd=csvForm();fd.set("confirm","1");expect((await importAction(null,fd))?.error).toContain("Revisar archivo");
 expect(await t.db.importBatch.count({where:{workspaceId:ws}})).toBe(0);expect(await t.db.transaction.count({where:{workspaceId:ws}})).toBe(0);
});
it("archivo revisado y confirmado conserva la cuenta, cantidad y totales",async()=>{
 const fd=csvForm(),review=await reviewFile(fd);expect("error" in review).toBe(false);if("error" in review)throw new Error(review.error);
 fd.set("reviewFingerprint",review.fingerprint);fd.set("confirm","1");await expect(importAction(null,fd)).rejects.toThrow("REDIRECT:");
 expect(await t.db.transaction.count({where:{workspaceId:ws,accountId:bankId,amount:"40"}})).toBe(1);
});
it("Gratis no revisa archivos OFX y una cuenta ajena no aparece en la revisión",async()=>{
 const fd=csvForm();fd.set("file",new File(["<OFX></OFX>"],"demo.ofx"));expect(await reviewFile(fd)).toMatchObject({error:expect.stringContaining("Pro")});
 const foreign=csvForm();foreign.set("accountId","cuenta-ajena");expect(await reviewFile(foreign)).toMatchObject({error:expect.stringContaining("cuenta activa")});
});
it("división manipulada desde el formulario no crea un gasto parcial",async()=>{
 const fd=new FormData();Object.entries({kind:"EXPENSE",status:"PAID",description:"Prueba",amount:"100",accountId:bankId,effectiveDate:"2026-11-23",split:"on",idem:"invalid-split"}).forEach(([k,v])=>fd.set(k,v));
 fd.append("splitCategory",categoryId);fd.append("splitAmount","20");
 const before=await t.db.transaction.count({where:{workspaceId:ws}});
 expect((await createMovementAction(null,fd))?.error).toContain("división");expect(await t.db.transaction.count({where:{workspaceId:ws}})).toBe(before);
});
