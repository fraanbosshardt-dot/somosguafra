"use server";
import { requireAdmin, adminAudit } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { CASE_STATUS } from "@/lib/chat-help";
import { revalidatePath } from "next/cache";
import type { FormState } from "./auth";
import { CHAT_TOPICS } from "@/lib/chat-help";
export async function adminChatHelpAction(
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await requireAdmin("owner"),
    topic = String(fd.get("topic")),
    answer = String(fd.get("answer") ?? "")
      .trim()
      .normalize("NFC");
  if (
    !CHAT_TOPICS.some((t) => t.id === topic) ||
    answer.length < 10 ||
    answer.length > 2000
  )
    return {
      error: "Elegí una pregunta y escribí entre 10 y 2000 caracteres.",
    };
  const value = { answer, enabled: fd.get("enabled") === "on" };
  await getDb().appSetting.upsert({
    where: { key: `chat-help:${topic}` },
    create: { key: `chat-help:${topic}`, value },
    update: { value },
  });
  await adminAudit(a, "admin.chat_help_updated", {
    entity: "chat-help",
    entityId: topic,
    meta: { enabled: value.enabled },
  });
  revalidatePath("/admin/soporte/respuestas");
  return { ok: "Respuesta automática guardada." };
}
export async function adminChatStateAction(
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await requireAdmin("support"),
    kind = String(fd.get("kind")),
    id = String(fd.get("id")),
    status = String(fd.get("status")),
    priority = String(fd.get("priority"));
  if (
    !["contact", "ticket"].includes(kind) ||
    !Object.hasOwn(CASE_STATUS, status) ||
    !["LOW", "NORMAL", "HIGH"].includes(priority)
  )
    return { error: "Revisá el estado y la prioridad." };
  const { updateSupportCase } = await import("@/server/support-case-state");
  const { UserError } = await import("@/server/ledger");
  try {
    await updateSupportCase(getDb(), {
      kind,
      id,
      status,
      priority,
      revision: String(fd.get("revision") ?? ""),
    });
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
  await adminAudit(a, "admin.case_status", {
    entity: kind,
    entityId: id,
    meta: { status, priority },
  });
  revalidatePath("/admin", "layout");
  return { ok: "Estado y prioridad actualizados." };
}
