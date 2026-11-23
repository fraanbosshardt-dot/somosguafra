"use server";
import { revalidatePath } from "next/cache";
import { requireWritableWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { applyBudgetCarry } from "@/server/budget-carry";
import { UserError } from "@/server/ledger";
import { reportError } from "@/lib/diagnostics";
import type { FormState } from "@/app/actions/auth";
export async function carryAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWritableWorkspace();
  try {
    await applyBudgetCarry(getDb(), workspace.id, String(fd.get("from") ?? ""), workspace.baseCurrency, todayIn(workspace.timezone), String(fd.get("fingerprint") ?? ""));
    revalidatePath("/app", "layout");
    return { ok: "Listo: se copiaron los límites y se sumó el margen revisado. No se movió dinero. Abrí el presupuesto de destino para verlo." };
  } catch (e) { if (!(e instanceof UserError)) reportError("budget-carry", e); return { error: e instanceof UserError ? e.message : "No pudimos trasladar. Intentá nuevamente." }; }
}
