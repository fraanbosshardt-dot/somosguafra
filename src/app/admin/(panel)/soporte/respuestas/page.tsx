import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { CHAT_TOPICS } from "@/lib/chat-help";
import { ActionForm, Submit } from "@/components/forms";
import { adminChatHelpAction } from "@/app/actions/chat-admin";
export const metadata = { title: "Respuestas de Guafra" };
export default async function ChatAnswers() {
  await requireAdmin("owner");
  const settings = await getDb().appSetting.findMany({
    where: { key: { startsWith: "chat-help:" } },
  });
  return (
    <>
      <Link className="lnk" href="/admin/soporte">
        ← Conversaciones
      </Link>
      <h1>Respuestas automáticas de Guafra</h1>
      <p className="sub">
        Guías preparadas, sin decisiones sobre cobros ni acceso. Los enlaces se
        mantienen en las pantallas oficiales. Desactivar una respuesta deriva
        esa consulta al equipo.
      </p>
      {CHAT_TOPICS.map((t) => {
        const override = settings.find((s) => s.key === `chat-help:${t.id}`)
          ?.value as { answer?: string; enabled?: boolean } | undefined;
        return (
          <details className="card" key={t.id}>
            <summary>{t.title}</summary>
            <ActionForm
              action={adminChatHelpAction}
              style={{ display: "grid", gap: 16, marginTop: 16 }}
            >
              <input type="hidden" name="topic" value={t.id} />
              <label className="field">
                Respuesta
                <textarea
                  name="answer"
                  rows={5}
                  minLength={10}
                  maxLength={2000}
                  required
                  defaultValue={override?.answer ?? t.answer}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={override?.enabled !== false}
                />
                Respuesta automática habilitada
              </label>
              <p className="sub">Referencia original: {t.answer}</p>
              <Submit>Guardar respuesta</Submit>
            </ActionForm>
          </details>
        );
      })}
    </>
  );
}
