import Link from "next/link";
import { HelpFaq } from "@/components/help-faq";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { supportTicketAction } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Ayuda" };

const FAQ: [string, string][] = [
  ["¿Qué diferencia hay entre Movimientos y Próximos pagos?", "Movimientos es lo que ya pasó: plata que entró o salió. Próximos pagos es lo que falta pagar o cobrar. Cuando registrás un pago pendiente, pasa a Movimientos."],
  ["¿Cómo uso la tarjeta de crédito?", "Al crearla elegís cómo: «Solo el resumen» (lo más fácil: una vez por mes cargás el total o subís el PDF y cuenta como un gasto del mes) o «Cada compra» (anotás cada compra con su categoría y cuotas, y el resumen se arma solo). Después el resumen aparece en Próximos pagos y elegís pagar el total, el mínimo u otro monto. Se cambia desde Editar tarjeta."],
  ["¿Cómo cargo una compra en cuotas?", "Con la tarjeta en modo «Cada compra», tocá «+ Registrar compra» y elegí las cuotas. El gasto se cuenta una vez por el total y cada mes entra la cuota en el resumen."],
  ["¿Las compras con tarjeta se cuentan dos veces?", "No. La compra es el gasto. Pagar el resumen es pasar plata de tu cuenta a la tarjeta, así que no suma como gasto otra vez."],
  ["¿Por qué lo invertido no aparece en Disponible?", "Porque no lo podés gastar hoy. Lo ves en Inversiones y en Patrimonio neto."],
  ["Me equivoqué en un movimiento", "Abrilo desde Movimientos: podés corregir el concepto, el importe, la categoría, la cuenta o la fecha. Si lo cargaste por error, tocá «Eliminar movimiento»: se borra del todo y el saldo vuelve a como estaba."],
  ["El saldo de una cuenta no coincide con el del banco", "Entrá a la cuenta y tocá «Corregir el saldo». Escribís lo que ves en el banco y se agrega una corrección por la diferencia, sin tocar tus movimientos."],
  ["¿Cómo cargo el sueldo, el alquiler o los servicios una sola vez?", "Cargalos como pago o cobro que se repite (desde Nuevo movimiento → Más opciones, o en Configuración → Pagos que se repiten). Aparecen solos en Próximos pagos todos los meses. Si el monto cambia, marcalos como variables y al pagar ponés el real."],
  ["¿Cómo armo un presupuesto?", "En Presupuestos, agregá con «+ Agregar una categoría» solo las que querés controlar. Te sugerimos el monto según lo que gastaste los últimos 3 meses. Lo que gastes en las demás no descuenta."],
  ["¿Cómo cargo un préstamo?", "Lo más fácil: en Deudas y préstamos subí el contrato en PDF y revisá lo que completamos. Si no, cargá cuánto te prestaron, en cuántas cuotas y cuánto pagás por mes. Si las cuotas cambian, pegá el cronograma del banco. Cuando pagás una cuota, poné lo que pagaste: queda como la cuota real de ese mes."],
  ["¿Cómo cargo acciones, bonos o cripto?", "En Inversiones, «+ Agregar inversión»: escribí la especie (aparecen sugerencias), cuántas tenés y cuánto pagaste. El precio se actualiza solo (Argentina, exterior y cripto) y ves cuánto ganás. Los FCI van con el valor de la cuotaparte a mano."],
  ["¿Puedo compartir mis cuentas con mi pareja o mi familia?", "Sí, con Pro. En Configuración → Compartir generás un enlace de invitación para hasta 3 personas, que pueden cargar y editar o solo mirar. Cada una entra con su propia cuenta."],
  ["¿Cómo recibo avisos de vencimientos?", "Podés activar los avisos en el celular desde Configuración → General; en iPhone, primero instalá la app en la pantalla de inicio."],
  ["¿Cómo apago una función que no uso?", "En Configuración, pestaña Funciones. Lo que apagás desaparece del menú y tus datos quedan guardados."],
  ["¿Cómo confirmo mi correo?", "Tocá «Confirmar correo» en el aviso de la app. Se abre una pantalla aparte donde ingresás el código de 6 números o pedís uno nuevo. Revisá también spam. Confirmalo antes de pagar Pro o invitar a otra persona a tu espacio."],
  ["¿Cómo paso a Pro?", "Desde la web, con la sesión iniciada, elegí por mes o por año y tocá «Suscribirme a Pro»: te llevamos a Mercado Pago para autorizar el pago. También podés hacerlo desde Configuración → Plan. Solo el dueño del espacio puede contratarlo y el correo debe estar confirmado. Pro se habilita cuando Mercado Pago confirma un pago aprobado; volver a la app por sí solo no confirma el cobro."],
  ["¿La prueba de 14 días me cobra al terminar?", "La prueba es gratis, se activa una sola vez desde Configuración → Plan y no te pide tarjeta. Si no contratás Pro, al vencer volvés a Gratis. Si autorizás una suscripción durante la prueba, los cobros se programan para cuando termine; la fecha se informa antes de confirmar en Mercado Pago."],
  ["Ya contraté Pro, ¿por qué sigo en período gratuito?", "Conservás los días que te quedaban. En la landing y en Configuración → Plan vas a ver tu acceso gratuito y, por separado, Pro mensual o anual programado con su primer cobro. Autorizar la suscripción no confirma un pago. Si programaste el mensual y querés anual, usá «Pasar a anual»: conserva la fecha de inicio y detiene el acuerdo mensual anterior."],
  ["Cerré Mercado Pago sin pagar, ¿se cancela mi plan?", "Cerrar el checkout no pide una baja. La solicitud queda pendiente para retomarla sin repetir el alta. Para elegir otras condiciones, primero podés descartarla expresamente desde Tu plan. Mercado Pago puede llamar «suscripción cancelada» a esa solicitud descartada aunque no hayas pagado; eso no quita tus días gratuitos ni cancela otra suscripción activa."],
  ["¿Qué hago si aparece una solicitud de pago pendiente?", "Usá «Retomar solicitud» para abrir el mismo checkout con su importe y cupón originales. No contrates otra suscripción. Si dice que se está verificando, esperá o escribinos desde Ayuda. Si Mercado Pago ya la autorizó, al retomar se actualiza el estado de Tu plan y no se crea otro cobro."],
  ["¿Cuándo se renueva Pro?", "Según lo que elijas, por mes o por año. En Configuración → Plan podés ver el próximo cobro programado y hasta cuándo tenés acceso cubierto por tus pagos. Si Mercado Pago rechaza un cobro, el intento no agrega un período pagado."],
  ["¿Cómo cancelo Pro?", "En Configuración → Plan, tocá «Cancelar Pro». La baja se confirma con Mercado Pago: si hay un error, reintentá o contactanos. Una vez cancelado no se programan nuevos cobros y conservás Pro hasta el final del período ya pagado. Cancelar la renovación no pide automáticamente un reembolso."],
  ["Pagué y todavía no aparece Pro", "Esperá la confirmación de Mercado Pago y revisá Configuración → Plan. No repitas el pago si ya figura aprobado: escribinos desde Ayuda o Contacto → Planes y pagos para que podamos revisarlo."],
  ["¿Cómo pido un reembolso?", "Tenés 10 días corridos desde la contratación para pedir la devolución total según nuestra política. Usá el Botón de arrepentimiento del sitio o Contacto → Arrepentimiento, indicando el correo de tu cuenta. Recibís un número de trámite. La acreditación depende de Mercado Pago y del banco o tarjeta."],
  ["¿Qué correos me mandan?", "Enviamos correos de bienvenida y confirmación de cuenta, recuperación y seguridad del acceso, pagos y respuestas a consultas. No enviamos campañas de marketing ni resúmenes de tus finanzas por correo. Los avisos de vencimientos se consultan en la app o se activan como notificaciones en el dispositivo."],
  ["¿Dónde veo la respuesta a mi consulta?", "Si escribiste desde Ayuda, aparece en «Tus consultas», en esta misma pantalla. Si usaste el formulario público de Contacto, te respondemos al correo que indicaste y recibís un número de trámite."],
  ["¿Cómo descargo mis datos o borro mi cuenta?", "En Configuración → Importar y exportar descargás tus movimientos; el respaldo completo está en Configuración → Tus datos. Para borrar la cuenta, entrá a Configuración → Seguridad. Si tenés una suscripción paga activa, primero cancelala para detener los cobros. La eliminación es definitiva."],
  ["¿Se conecta con mi banco?", "No. Cargás tus movimientos o importás el extracto del banco o de Mercado Pago (CSV; con Pro también Excel y OFX), desde Configuración → Importar y exportar. Nunca te pedimos la clave del banco."],
  ["¿Qué hago si pierdo el teléfono del segundo factor?", "Guardá previamente tus códigos de recuperación desde Configuración → Seguridad. Al ingresar, elegí Usar un código de recuperación. Cada uno sirve una sola vez. Si no tenés códigos ni acceso a tu autenticador, contactanos: verificamos la identidad antes de recuperar el acceso."],
  ["¿Qué pasa con un espacio compartido al volver a Gratis?", "Los datos y las membresías se conservan. Los invitados pueden consultar el espacio; editar y sumar nuevas personas requiere Pro. Solo el dueño administra el plan. Podés salir del espacio cuando quieras."],
  ["¿Cuándo recibimos Pro por una invitación?", "La persona invitada debe confirmar el correo, terminar la bienvenida y registrar su primer movimiento. El premio se acredita una sola vez. Si ya tenés una suscripción paga o programada, los días se guardan: no cambian tus cobros actuales y se aplican cuando ya no haya renovación ni período pago vigente."],
];

export default async function Help() {
  const { user, plan } = await requireWorkspace();
  const tickets = await getDb().supportTicket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <>
      <PageHead crumb="Ajustes" title="Ayuda" desc="Respuestas rápidas y una forma de escribirnos." />
      <div className="grid g32">
        <div className="card">
          <div className="chead"><h3>Preguntas frecuentes</h3></div>
          <HelpFaq items={FAQ} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="chead"><h3>Escribinos</h3></div>
            <p className="sub" style={{ marginBottom: 12 }}>Para reembolsos, bajas o privacidad también podés usar <Link className="lnk" href="/contacto">Contacto</Link>. Consultá <Link className="lnk" href="/terminos">Términos</Link>, <Link className="lnk" href="/privacidad">Privacidad</Link>, <Link className="lnk" href="/reembolsos">Reembolsos</Link> y <Link className="lnk" href="/cookies">Cookies</Link>.</p>
            <ActionForm action={supportTicketAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="field">Asunto<input name="subject" maxLength={140} required /></label>
              <label className="field">Contanos qué pasó<textarea name="body" rows={5} maxLength={4000} required /></label>
              <div><Submit pending="Enviando…">Enviar</Submit></div>
              {plan === "PRO" && <p className="sub" style={{ margin: 0 }}>Con Pro tu consulta va primero: te respondemos dentro de 1 día hábil.</p>}
            </ActionForm>
          </div>
          {tickets.length > 0 && (
            <div className="card">
              <div className="chead"><h3>Tus consultas</h3></div>
              <div className="list">
                {tickets.map((t) => (
                  <div className="li" key={t.id} style={{ display: "block" }}>
                    <div className="t">{t.subject}</div>
                    <div className="s">{fmtDate(t.createdAt)} · {t.status === "CLOSED" ? "Cerrada" : t.reply ? "Respondida" : "Esperando respuesta"}</div>
                    {t.reply && <p className="notice" style={{ marginTop: 8 }}><span><b>Somos Guafra:</b> {t.reply}</span></p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
