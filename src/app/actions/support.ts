"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { customerReply, resolveCaseToken } from "@/server/support-thread";
import type { FormState } from "./auth";
import { UserError } from "@/server/ledger";
export async function supportFollowupAction(_: FormState, fd: FormData): Promise<FormState> {
  const db = getDb(); const token = String(fd.get("token") ?? "");
  let target: { kind: "contact" | "ticket"; id: string } | null;
  if (token) target = await resolveCaseToken(db, token);
  else {
    const { user } = await requireUser();
    const ticket = await db.supportTicket.findFirst({ where: { id: String(fd.get("ticketId") ?? ""), userId: user.id } });
    target = ticket ? { kind: "ticket", id: ticket.id } : null;
  }
  if (!target) return { error: "El enlace venció o la consulta no pertenece a tu cuenta." };
  try { await customerReply(db, target.kind, target.id, String(fd.get("body") ?? ""), String(fd.get("nonce") ?? "")); }
  catch (e) { return { error: e instanceof UserError ? e.message : "No pudimos guardar el mensaje. Intentá de nuevo." }; }
  revalidatePath("/app/ayuda"); revalidatePath("/admin", "layout");
  if (token) revalidatePath(`/consulta/${token}`);
  return { ok: "Mensaje recibido. Te respondemos en esta conversación." };
}
