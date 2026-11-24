"use server";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { FormState } from "./auth";
import { saveCommunicationPreferences } from "@/server/communication-preferences";
export async function saveCommunicationPreferencesAction(_: FormState, fd: FormData): Promise<FormState> {
  const {user} = await requireUser();
  await saveCommunicationPreferences(getDb(),user.id,{tips:fd.get("tips")==="on",news:fd.get("news")==="on",offers:fd.get("offers")==="on"});
  revalidatePath("/app/configuracion");
  return {ok:"Preferencias guardadas. Los avisos de seguridad, pagos y soporte siguen separados."};
}
