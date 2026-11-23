"use server";
import { revalidatePath } from "next/cache";
import { requireWritableWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { saveExperience } from "@/server/experience";
import { UserError } from "@/server/ledger";
import { reportError } from "@/lib/diagnostics";
import type { FormState } from "@/app/actions/auth";
export async function experienceAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWritableWorkspace();
  const action = String(fd.get("action"));
  if (!["favorite", "rule", "removeFavorite", "removeRule"].includes(action)) return { error: "Elegí una acción válida." };
  try {
    await saveExperience(getDb(), workspace.id, action as Parameters<typeof saveExperience>[2], Object.fromEntries(["id", "name", "kind", "accountId", "categoryId"].map(k => [k, String(fd.get(k) ?? "")])));
    revalidatePath("/app", "layout");
    return { ok: action.startsWith("remove") ? "Quitado. Tus movimientos no cambiaron." : "Guardado. Se usará como sugerencia en nuevas cargas; no modifica movimientos anteriores." };
  } catch (e) { if (!(e instanceof UserError)) reportError("experience", e); return { error: e instanceof UserError ? e.message : "No pudimos guardar. Intentá de nuevo." }; }
}
