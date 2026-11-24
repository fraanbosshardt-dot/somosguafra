import { beforeAll, afterAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, payObligation } from "@/server/ledger";
import { createRule, changeRuleFrom, materialize } from "@/server/recurring";
let t: Awaited<ReturnType<typeof startTestDb>>;
let ws: string, account: string, otherAccount: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => {
  t = await startTestDb();
  for (const email of ["rec-edit@audit.invalid", "rec-other@audit.invalid"]) {
    const user = await t.db.user.create({data:{email,name:"Demo",passwordHash:"fixture"}});
    const space = await createWorkspaceForUser(t.db,user.id);
    const bank = await createAccount(t.db,space.id,{name:"Demo",currency:"ARS",type:"SAVINGS",initialBalance:"10000",initialDate:d("2026-11-01")});
    if (!ws) { ws = space.id; account = bank.id; } else otherAccount = bank.id;
  }
},60_000);
afterAll(async () => t?.stop());
const rule = (description: string) => createRule(t.db,ws,{description,accountId:account,direction:"PAYABLE",amount:"100",currency:"ARS",frequency:"MONTHLY",dayOfMonth:10,startDate:d("2026-11-10")});
it("corrige dirección, concepto y cuenta solo para pendientes futuros y conserva el pago anterior",async () => {
  const r = await rule("Sueldo");
  await materialize(t.db,ws,d("2027-01-31"));
  const paid = await t.db.obligation.findFirstOrThrow({where:{recurringRuleId:r.id},orderBy:{dueDate:"asc"}});
  await payObligation(t.db,ws,{obligationId:paid.id,accountId:account,amount:"100",date:d("2026-11-10")});
  const next = await changeRuleFrom(t.db,ws,r.id,d("2026-12-01"),{direction:"RECEIVABLE",description:"Sueldo recibido",amount:"200"});
  await materialize(t.db,ws,d("2027-01-31"));
  expect(await t.db.obligation.findUnique({where:{id:paid.id}})).toMatchObject({direction:"PAYABLE",status:"SETTLED",description:"Sueldo"});
  const future = await t.db.obligation.findMany({where:{recurringRuleId:next.id}});
  expect(future).toHaveLength(2);
  expect(future.every(o => o.direction === "RECEIVABLE" && o.description === "Sueldo recibido" && o.amount.toString() === "200")).toBe(true);
  expect(await t.db.transaction.count({where:{obligationId:paid.id}})).toBe(1);
});
it("rechaza una fecha que volvería a generar una ocurrencia ya pagada y no modifica la regla",async () => {
  const r = await rule("Pago protegido");
  await materialize(t.db,ws,d("2026-12-31"));
  const paid = await t.db.obligation.findFirstOrThrow({where:{recurringRuleId:r.id},orderBy:{dueDate:"desc"}});
  await payObligation(t.db,ws,{obligationId:paid.id,accountId:account,amount:"100",date:d("2026-11-20")});
  await expect(changeRuleFrom(t.db,ws,r.id,d("2026-12-01"),{amount:"200"})).rejects.toThrow(/confirmadas/);
  expect((await t.db.recurringRule.findUniqueOrThrow({where:{id:r.id}})).endDate).toBeNull();
  expect(await t.db.recurringRule.count({where:{previousVersionId:r.id}})).toBe(0);
});
it("rechaza cuenta ajena y segunda versión desde una pantalla desactualizada",async () => {
  const r = await rule("Aislamiento");
  await expect(changeRuleFrom(t.db,ws,r.id,d("2026-12-01"),{accountId:otherAccount})).rejects.toThrow(/cuenta activa/);
  await changeRuleFrom(t.db,ws,r.id,d("2026-12-01"),{amount:"200"});
  await expect(changeRuleFrom(t.db,ws,r.id,d("2026-12-01"),{amount:"300"})).rejects.toThrow(/versión nueva/);
  expect(await t.db.recurringRule.count({where:{previousVersionId:r.id}})).toBe(1);
});
