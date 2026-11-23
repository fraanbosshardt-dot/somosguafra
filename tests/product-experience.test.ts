import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { accountBalances, createAccount, recordMovement, reverseTransaction } from "@/server/ledger";
import { budgetFor, saveBudget } from "@/server/planning";
import { categoryReport, autoMap, previewImport, applyImport, exportBackup } from "@/server/io";
import { saveExperience } from "@/server/experience";
import { experienceFrom, ruleSuggestion } from "@/lib/experience";
import { importMatches, selectedImport, importFingerprint } from "@/server/import-review";
import { previewBudgetCarry, applyBudgetCarry } from "@/server/budget-carry";
import { annualEquivalent, recurringCosts } from "@/server/recurring-costs";
import { createRule } from "@/server/recurring";
import { matchChatHelp } from "@/lib/chat-help";
import { dec } from "@/lib/money";
let t: Awaited<ReturnType<typeof startTestDb>>, seq=0;
const date = new Date("2026-11-18T00:00:00Z"), october = new Date("2026-10-15T00:00:00Z");
beforeAll(async () => { t=await startTestDb(); },60000);
afterAll(async () => { await t?.stop(); });
async function setup(pro=false) {
  const user=await t.db.user.create({data:{name:"Demostración",email:`product-${seq++}@audit.invalid`,passwordHash:"fixture"}});
  const workspace=await createWorkspaceForUser(t.db,user.id), ws=workspace.id;
  if(pro) await t.db.subscription.update({where:{workspaceId:ws},data:{plan:"PRO",status:"ACTIVE",provider:"manual"}});
  const bank=await createAccount(t.db,ws,{name:"Banco de prueba",type:"SAVINGS",currency:"ARS",initialBalance:"1000",initialDate:october});
  const cats=await t.db.category.findMany({where:{workspaceId:ws,kind:"EXPENSE",parentId:null},take:2});
  return {user,ws,bank,cats};
}
it("favoritos guardan cuenta/categoría sin importes, preservan funciones y no crean movimientos",async()=>{
  const s=await setup();
  await t.db.workspace.update({where:{id:s.ws},data:{modules:{flujo:true,objetivos:false}}});
  await saveExperience(t.db,s.ws,"favorite",{name:"Mercado",kind:"EXPENSE",accountId:s.bank.id,categoryId:s.cats[0].id});
  await saveExperience(t.db,s.ws,"favorite",{name:"MÉRCADO",kind:"EXPENSE",accountId:s.bank.id,categoryId:s.cats[1].id});
  const space=await t.db.workspace.findUniqueOrThrow({where:{id:s.ws}}), p=experienceFrom(space.modules);
  expect(p.favorites).toHaveLength(1);expect(p.favorites[0].categoryId).toBe(s.cats[1].id);
  expect(space.modules).toMatchObject({flujo:true,objetivos:false});expect(await t.db.transaction.count({where:{workspaceId:s.ws}})).toBe(0);
  const backup=JSON.parse(await exportBackup(t.db,s.ws));expect(JSON.stringify(backup)).toContain("MÉRCADO");
});
it("favoritos y reglas rechazan cuentas y categorías ajenas, sin alterar preferencias",async()=>{
  const s=await setup(true), other=await setup();
  await expect(saveExperience(t.db,s.ws,"favorite",{name:"Mercado",kind:"EXPENSE",accountId:other.bank.id})).rejects.toThrow("cuenta activa");
  await expect(saveExperience(t.db,s.ws,"rule",{name:"Mercado",kind:"EXPENSE",categoryId:other.cats[0].id})).rejects.toThrow("categoría activa");
  expect(experienceFrom((await t.db.workspace.findUniqueOrThrow({where:{id:s.ws}})).modules).rules).toHaveLength(0);
});
it("reglas son Pro, sugieren sin tocar historial y se pueden quitar en Gratis",async()=>{
  const s=await setup();
  await expect(saveExperience(t.db,s.ws,"rule",{name:"Mercado",kind:"EXPENSE",categoryId:s.cats[0].id})).rejects.toThrow("Pro");
  await t.db.subscription.update({where:{workspaceId:s.ws},data:{plan:"PRO",status:"ACTIVE",provider:"manual"}});
  const p=await saveExperience(t.db,s.ws,"rule",{name:"Mercado",kind:"EXPENSE",categoryId:s.cats[0].id});
  expect(ruleSuggestion(p.rules,"EXPENSE","MÉRCADO central")).toBe(s.cats[0].id);
  expect(ruleSuggestion(p.rules,"INCOME","Mercado central")).toBeNull();
  await t.db.subscription.update({where:{workspaceId:s.ws},data:{plan:"FREE"}});
  await saveExperience(t.db,s.ws,"removeRule",{id:p.rules[0].id});
  expect(await t.db.transaction.count({where:{workspaceId:s.ws}})).toBe(0);
});
it("compra dividida descuenta exactamente el total, reparte presupuestos e informes y no se duplica con dos envíos",async()=>{
  const s=await setup(), input={kind:"EXPENSE" as const,description:"Compra mixta",amount:"80.50",accountId:s.bank.id,status:"PAID" as const,effectiveDate:date,idempotencyKey:"split-id",splits:[{categoryId:s.cats[0].id,amount:"60.25"},{categoryId:s.cats[1].id,amount:"20.25"}]};
  await Promise.all([recordMovement(t.db,s.ws,input),recordMovement(t.db,s.ws,input)]);
  expect(await t.db.transaction.count({where:{workspaceId:s.ws}})).toBe(2);
  expect((await accountBalances(t.db,s.ws)).get(s.bank.id)?.toString()).toBe("919.5");
  const report=await categoryReport(t.db,s.ws,"ARS","2026-11",1);expect(report.totals[0].expense.toString()).toBe("80.5");
  expect((await budgetFor(t.db,s.ws,"2026-11","ARS",date)).rows.filter(r=>r.spent.gt(0)).map(r=>r.spent.toString()).sort()).toEqual(["20.25","60.25"]);
});
it("división inválida o categoría ajena no escribe ninguna parte",async()=>{
  const s=await setup(), other=await setup();
  const input={kind:"EXPENSE" as const,description:"Compra",amount:"80",accountId:s.bank.id,status:"PAID" as const,effectiveDate:date};
  await expect(recordMovement(t.db,s.ws,{...input,splits:[{categoryId:s.cats[0].id,amount:"60"},{categoryId:s.cats[1].id,amount:"19"}]})).rejects.toThrow("suma igual");
  await expect(recordMovement(t.db,s.ws,{...input,splits:[{categoryId:s.cats[0].id,amount:"60"},{categoryId:other.cats[0].id,amount:"20"}]})).rejects.toThrow();
  await expect(recordMovement(t.db,s.ws,{...input,status:"PARTIAL",paidAmount:"20",dueDate:date,splits:[{categoryId:s.cats[0].id,amount:"60"},{categoryId:s.cats[1].id,amount:"20"}]})).rejects.toThrow();
  expect(await t.db.transaction.count({where:{workspaceId:s.ws}})).toBe(0);
});
it("revertir una parte devuelve solo su importe y no altera la otra categoría",async()=>{
  const s=await setup();
  const result=await recordMovement(t.db,s.ws,{kind:"EXPENSE",description:"Compra",amount:"80",accountId:s.bank.id,status:"PAID",effectiveDate:date,splits:[{categoryId:s.cats[0].id,amount:"60"},{categoryId:s.cats[1].id,amount:"20"}]});
  await reverseTransaction(t.db,s.ws,result.transactionId!);
  expect((await categoryReport(t.db,s.ws,"ARS","2026-11",1)).totals[0].expense.toString()).toBe("20");
  expect((await accountBalances(t.db,s.ws)).get(s.bank.id)?.toString()).toBe("980");
});
const csv="Fecha,Concepto,Importe\n18/11/2026,Mercado,-50\n18/11/2026,Mercado,-50\n18/11/2026,Trabajo,100\n";
it("revisión conserva filas idénticas para decidir si omitirlas; el contador refleja lo guardado",async()=>{
  const s=await setup();const preview=await previewImport(t.db,s.ws,s.bank.id,csv,autoMap(csv));
  expect(preview.ok).toHaveLength(3);expect(preview.duplicates).toBe(0);expect(preview.ok[1].repeatedInFile).toBe(true);
  const batch=await applyImport(t.db,s.ws,s.bank.id,"demo.csv",selectedImport(preview,preview.ok.filter(r=>r.repeatedInFile).map(r=>r.key)));
  expect(batch.rows).toBe(2);expect((await accountBalances(t.db,s.ws)).get(s.bank.id)?.toString()).toBe("1050");
  const again=await previewImport(t.db,s.ws,s.bank.id,csv,autoMap(csv));expect(again.ok).toHaveLength(1);expect(again.ok[0].repeatedInFile).toBe(true);expect(again.duplicates).toBe(2);
});
it("importación de dos pestañas no duplica movimientos ni deja lote vacío",async()=>{
  const s=await setup(), preview=await previewImport(t.db,s.ws,s.bank.id,csv,autoMap(csv));
  const result=await Promise.allSettled([applyImport(t.db,s.ws,s.bank.id,"1.csv",preview),applyImport(t.db,s.ws,s.bank.id,"2.csv",preview)]);
  expect(result.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect(await t.db.importBatch.count({where:{workspaceId:s.ws}})).toBe(1);expect(await t.db.transaction.count({where:{workspaceId:s.ws}})).toBe(3);
});
it("fallo a mitad de importación revierte todas sus filas y su lote",async()=>{
  const s=await setup(), preview=await previewImport(t.db,s.ws,s.bank.id,csv,autoMap(csv));
  preview.ok[1].description="";
  await expect(applyImport(t.db,s.ws,s.bank.id,"demo.csv",preview)).rejects.toThrow("concepto");
  expect(await t.db.transaction.count({where:{workspaceId:s.ws}})).toBe(0);expect(await t.db.importBatch.count({where:{workspaceId:s.ws}})).toBe(0);
});
it("revisión asistida limita coincidencias a cuenta, moneda implícita y fecha; omitir no borra lo existente",async()=>{
  const s=await setup(), other=await setup();
  await recordMovement(t.db,s.ws,{kind:"EXPENSE",description:"Mercado",amount:"50",accountId:s.bank.id,status:"PAID",effectiveDate:date});
  const preview=await previewImport(t.db,s.ws,s.bank.id,csv,autoMap(csv));
  const matches=await importMatches(t.db,s.ws,s.bank.id,preview);
  expect(matches).toHaveLength(2);expect(matches[0].exact).toBe(true);
  expect(await importMatches(t.db,other.ws,s.bank.id,preview)).toHaveLength(0);
  const selected=selectedImport(preview,matches.map(m=>m.key));
  await applyImport(t.db,s.ws,s.bank.id,"demo.csv",selected);
  expect(await t.db.transaction.count({where:{workspaceId:s.ws}})).toBe(2);
  expect(()=>selectedImport(preview,["foreign-key"])).toThrow();
  expect(importFingerprint(s.bank.id,csv,preview,matches)).not.toBe(importFingerprint(s.bank.id,csv,preview,[]));
});
it("traslado Pro conserva centavos, no mueve saldos y no se aplica dos veces",async()=>{
  const s=await setup(true);
  await saveBudget(t.db,s.ws,"2026-10","ARS",[{categoryId:s.cats[0].id,limit:"100.50",projectRemaining:true}]);
  await recordMovement(t.db,s.ws,{kind:"EXPENSE",description:"Compra",amount:"40.25",accountId:s.bank.id,categoryId:s.cats[0].id,status:"PAID",effectiveDate:october});
  await recordMovement(t.db,s.ws,{kind:"EXPENSE",description:"Pendiente",amount:"10.10",accountId:s.bank.id,categoryId:s.cats[0].id,status:"PENDING",dueDate:october});
  const preview=await previewBudgetCarry(t.db,s.ws,"2026-10","ARS",date);
  expect(preview.lines[0]).toMatchObject({base:"100.50",extra:"50.15",total:"150.65"});
  const before=(await accountBalances(t.db,s.ws)).get(s.bank.id)?.toString();
  await applyBudgetCarry(t.db,s.ws,"2026-10","ARS",date,preview.fingerprint);
  const dest=await budgetFor(t.db,s.ws,"2026-11","ARS",date);
  expect(dest.rows[0].limit?.toString()).toBe("150.65");expect(dest.rows[0].projectRemaining).toBe(true);
  expect((await accountBalances(t.db,s.ws)).get(s.bank.id)?.toString()).toBe(before);
  await expect(applyBudgetCarry(t.db,s.ws,"2026-10","ARS",date,preview.fingerprint)).rejects.toThrow("ya tiene límites");
});
it("traslado rechaza Gratis, mes abierto, moneda distinta y revisión desactualizada",async()=>{
  const s=await setup();await saveBudget(t.db,s.ws,"2026-10","ARS",[{categoryId:s.cats[0].id,limit:"100"}]);
  const preview=await previewBudgetCarry(t.db,s.ws,"2026-10","ARS",date);
  await expect(applyBudgetCarry(t.db,s.ws,"2026-10","ARS",date,preview.fingerprint)).rejects.toThrow("Pro");
  await expect(previewBudgetCarry(t.db,s.ws,"2026-11","ARS",date)).rejects.toThrow("terminó");
  await expect(previewBudgetCarry(t.db,s.ws,"2026-10","USD",date)).rejects.toThrow("moneda");
  await t.db.subscription.update({where:{workspaceId:s.ws},data:{plan:"PRO",status:"ACTIVE",provider:"manual"}});
  await saveBudget(t.db,s.ws,"2026-10","ARS",[{categoryId:s.cats[0].id,limit:"90"}]);
  await expect(applyBudgetCarry(t.db,s.ws,"2026-10","ARS",date,preview.fingerprint)).rejects.toThrow("cambió");
});
it("exceso de presupuesto no genera margen negativo ni ingreso artificial",async()=>{
  const s=await setup();await saveBudget(t.db,s.ws,"2026-10","ARS",[{categoryId:s.cats[0].id,limit:"10"}]);
  await recordMovement(t.db,s.ws,{kind:"EXPENSE",description:"Compra",amount:"20",accountId:s.bank.id,categoryId:s.cats[0].id,status:"PAID",effectiveDate:october});
  expect((await previewBudgetCarry(t.db,s.ws,"2026-10","ARS",date)).lines[0]).toMatchObject({extra:"0.00",total:"10.00"});
});
it("equivalentes anuales mantienen centavos y separan monedas sin crear obligaciones",async()=>{
  expect(annualEquivalent("10.25","MONTHLY").toString()).toBe("123");expect(annualEquivalent("10","QUARTERLY").toString()).toBe("40");expect(annualEquivalent("10","MONTHLY",3).toString()).toBe("40");expect(annualEquivalent("1","DAILY").toString()).toBe("365");
  const s=await setup();
  await createRule(t.db,s.ws,{direction:"PAYABLE",description:"Servicio ARS",amount:"10.25",currency:"ARS",frequency:"MONTHLY",startDate:october});
  await createRule(t.db,s.ws,{direction:"PAYABLE",description:"Servicio USD",amount:"5",currency:"USD",frequency:"ANNUAL",startDate:october});
  const costs=await recurringCosts(t.db,s.ws,date);
  expect(costs.totals.map(t=>[t.currency,t.annual.toString()])).toEqual([["ARS","123"],["USD","5"]]);
  expect(await t.db.obligation.count({where:{workspaceId:s.ws}})).toBe(0);
});
it("ayuda del bot reconoce herramientas nuevas y mantiene derivación de reclamos sensibles",()=>{
  expect(matchChatHelp("quiero dividir una compra").topic?.id).toBe("split-purchase");
  expect(matchChatHelp("trasladar margen").topic?.id).toBe("budget-carry");
  expect(matchChatHelp("me cobraron dos veces").escalate).toBe(true);
});

it("revisión reconoce el débito total de una compra dividida, no lo importa como otro gasto",async()=>{
 const s=await setup();
 await recordMovement(t.db,s.ws,{kind:"EXPENSE",description:"Compra mixta",amount:"80.50",accountId:s.bank.id,status:"PAID",effectiveDate:date,splits:[{categoryId:s.cats[0].id,amount:"60.25"},{categoryId:s.cats[1].id,amount:"20.25"}]});
 const text="Fecha,Concepto,Importe\n18/11/2026,Compra bancaria,-80.50\n";
 const preview=await previewImport(t.db,s.ws,s.bank.id,text,autoMap(text));
 const matches=await importMatches(t.db,s.ws,s.bank.id,preview);
 expect(matches[0].candidates[0].description).toContain("total de compra dividida");
});
it("confirmar vuelve a revisar bajo bloqueo y rechaza datos modificados desde la vista previa",async()=>{
 const s=await setup();const preview=await previewImport(t.db,s.ws,s.bank.id,csv,autoMap(csv));
 const fingerprint=importFingerprint(s.bank.id,csv,preview,[]);
 await recordMovement(t.db,s.ws,{kind:"EXPENSE",description:"Mercado",amount:"50",accountId:s.bank.id,status:"PAID",effectiveDate:date});
 await expect(applyImport(t.db,s.ws,s.bank.id,"demo.csv",preview,s.user.id,{text:csv,map:autoMap(csv),fingerprint,assisted:true,excluded:[]})).rejects.toThrow("cambiaron");
 expect(await t.db.importBatch.count({where:{workspaceId:s.ws}})).toBe(0);
});

it("dos operaciones idénticas confirmadas se conservan y una reimportación no las duplica",async()=>{
 const s=await setup(),preview=await previewImport(t.db,s.ws,s.bank.id,csv,autoMap(csv));
 const batch=await applyImport(t.db,s.ws,s.bank.id,"demo.csv",preview);
 expect(batch.rows).toBe(3);expect((await accountBalances(t.db,s.ws)).get(s.bank.id)?.toString()).toBe("1000");
 expect((await previewImport(t.db,s.ws,s.bank.id,csv,autoMap(csv))).ok).toHaveLength(0);
});

it("importar conserva redondeo monetario half-even y rechaza un importe que redondea a cero",async()=>{
 const s=await setup();const text="Fecha;Concepto;Importe\n18/11/2026;Centavos;-0,015\n";
 const p=await previewImport(t.db,s.ws,s.bank.id,text,autoMap(text));await applyImport(t.db,s.ws,s.bank.id,"centavos.csv",p);
 expect((await t.db.transaction.findFirstOrThrow({where:{workspaceId:s.ws}})).amount.toString()).toBe("0.02");
 const small="Fecha;Concepto;Importe\n18/11/2026;Importe minimo;-0,005\n";
 await expect(applyImport(t.db,s.ws,s.bank.id,"minimo.csv",await previewImport(t.db,s.ws,s.bank.id,small,autoMap(small)))).rejects.toThrow("importe");
 expect(await t.db.importBatch.count({where:{workspaceId:s.ws}})).toBe(1);
});
