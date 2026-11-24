import Link from "next/link";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { BRAND } from "@/lib/brand";
import { ActionForm, Submit } from "@/components/forms";
import { SupportThread } from "@/components/support-thread";
import { supportFollowupAction } from "@/app/actions/support";
import { MvBackHead } from "../../head";

export const metadata: Metadata = { title: "Ayuda" };

// Preguntas de la app, en español neutro y con los nombres de sus pantallas.
const FAQ: [string, string][] = [
  ["¿Qué diferencia hay entre Movimientos y Próximos?", "Movimientos es lo que ya pasó: dinero que entró o salió. Próximos es lo que falta pagar o cobrar. Cuando registras un pago pendiente, pasa a Movimientos."],
  ["¿Qué es «Te queda» en Inicio?", "Lo que puedes gastar hasta tu próximo cobro: el dinero de tus cuentas menos lo que vence antes de esa fecha. Toca el ícono de información en Inicio para ver la cuenta."],
  ["Me equivoqué en un movimiento", "Ábrelo desde Movimientos: puedes corregir el concepto, el monto, la categoría, la cuenta o la fecha. Si lo cargaste por error, toca «Eliminar movimiento» y el saldo vuelve a como estaba."],
  ["El saldo de una cuenta no coincide con el del banco", "En Explorar → Cuentas, abre la cuenta y usa «¿No coincide con tu banco?». Escribes lo que ves en el banco y agregamos una corrección por la diferencia, sin tocar tus movimientos."],
  ["¿Cómo cargo el sueldo, el alquiler o los servicios una sola vez?", "Toca + y luego, en Próximos, «+ Agregar» con «Se repite todos los meses». También desde Explorar → Pagos que se repiten. Aparecen solos en Próximos cada mes."],
  ["¿Cómo uso la tarjeta de crédito?", "En Explorar → Tarjetas eliges cómo usarla: «Solo el resumen» (una vez por mes cargas el total) o «Cada compra» (cargas cada compra con sus cuotas y el resumen se arma solo). El resumen aparece en Próximos para pagarlo."],
  ["¿Las compras con tarjeta se cuentan dos veces?", "No. La compra es el gasto. Pagar el resumen es pasar dinero de tu cuenta a la tarjeta, así que no suma como otro gasto."],
  ["¿Cómo armo un presupuesto?", "En Explorar → Presupuestos eliges el mes y pones un límite a las categorías que quieres controlar. Lo que gastas en esas categorías se descuenta solo."],
  ["¿Se conecta con mi banco?", "No. Cargas tus movimientos tú mismo. Nunca te pedimos la clave del banco."],
  ["¿Cómo recibo avisos de vencimientos?", "En Explorar → Configuración → General puedes activar los avisos en este celular."],
  ["¿Cómo apago una función que no uso?", "En Explorar → Configuración → Funciones. Lo que apagas desaparece de Explorar y tus datos quedan guardados."],
  ["¿Cómo paso a Pro?", "Desde Explorar → Pasa a Pro. En la app de Android, Pro se paga con Google Play. Si ya pagas Pro desde la web, lo sigues gestionando allí."],
  ["¿Cómo descargo mis datos o borro mi cuenta?", "En Explorar → Configuración → Tus datos puedes descargar tus movimientos o todo tu respaldo. Para borrar la cuenta, entra en Configuración → Seguridad → Borrar mi cuenta. Es definitivo."],
  ["¿Qué hago si pierdo el teléfono del segundo paso?", "Guarda antes tus códigos de recuperación desde Configuración → Seguridad. Al ingresar, elige usar un código de recuperación. Si no los tienes, escríbenos y verificamos tu identidad."],
];

export default async function AyudaMovil() {
  const { user } = await requireWorkspace();
  const tickets = await getDb().supportTicket.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10, include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } } });
  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Tu cuenta" title="Ayuda" />
      <section className="mv-sec" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Preguntas frecuentes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQ.map(([q, a]) => (
            <details key={q} className="mv-card mv-more">
              <summary>{q}</summary>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--muted)", lineHeight: 1.5 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="mv-h2" style={{ fontSize: 16 }}>Escríbenos</h2>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>Atención: {BRAND.supportHours}. Puedes dejar tu consulta en cualquier momento y te avisamos por correo cuando respondamos.</p>
        <Link className="mv-btn pri" href="/contacto" style={{ flex: "none" }}>Enviar una consulta</Link>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
          <Link href="/terminos" style={{ color: "var(--brand)" }}>Términos</Link> · <Link href="/privacidad" style={{ color: "var(--brand)" }}>Privacidad</Link> · <Link href="/reembolsos" style={{ color: "var(--brand)" }}>Reembolsos</Link>
        </p>
      </section>

      {tickets.length > 0 && (
        <section className="mv-sec" style={{ gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Tus consultas</h2>
          {tickets.map((t) => (
            <details key={t.id} className="mv-card mv-more">
              <summary><span style={{ display: "flex", flexDirection: "column" }}><span>{t.subject}</span><span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{fmtDate(t.createdAt)} · {t.status === "CLOSED" ? "Cerrada" : t.reply ? "Respondida" : "Esperando respuesta"}</span></span></summary>
              <div className="mv-web">
                <SupportThread body={t.body} reply={t.reply} messages={t.messages} />
                {t.status !== "CLOSED" && (
                  <ActionForm action={supportFollowupAction} resetOnOk className="mv-web">
                    <input type="hidden" name="ticketId" value={t.id} /><input type="hidden" name="nonce" value={randomUUID()} />
                    <label className="field">Continuar esta consulta<textarea name="body" rows={3} maxLength={5000} required style={{ paddingTop: 12 }} /></label>
                    <div><Submit>Enviar mensaje</Submit></div>
                  </ActionForm>
                )}
              </div>
            </details>
          ))}
        </section>
      )}
    </main>
  );
}
