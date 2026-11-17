export const REPLY_AREAS: Record<string,string> = {general:"General",soporte:"Uso de la app",pagos:"Pagos y suscripción",acceso:"Acceso y cuenta",privacidad:"Privacidad y seguridad",reclamos:"Reclamos",arrepentimiento:"Arrepentimiento"};
export type SavedSupportReply = {title:string;text:string;area?:string};
export const DEFAULT_SUPPORT_REPLIES: SavedSupportReply[] = [
  {title:"Recibimos tu consulta",area:"general",text:"Hola {nombre}, recibimos tu consulta {caso}. Vamos a revisarla y te responderemos en esta misma conversación. Podés agregar acá cualquier detalle que nos ayude."},
  {title:"Necesitamos más información",area:"soporte",text:"Hola {nombre}, para revisar el caso {caso}, contanos en qué pantalla sucede, qué intentabas hacer y qué mensaje apareció. No compartas contraseñas, códigos ni datos completos de tarjetas."},
  {title:"Pago en revisión",area:"pagos",text:"Hola {nombre}, vamos a revisar el estado de tu pago en el caso {caso}. Si ya figura aprobado, no repitas el pago. Podés indicarnos la fecha y la referencia de la operación, sin compartir datos de tarjeta. Te confirmaremos el resultado después de verificarlo."},
  {title:"Solicitud de baja",area:"pagos",text:"Hola {nombre}, registramos tu solicitud de baja en el caso {caso}. Vamos a verificar la suscripción y los cobros programados. Este mensaje confirma la recepción del pedido; te avisaremos cuando la gestión esté confirmada."},
  {title:"Recuperar acceso",area:"acceso",text:"Hola {nombre}, podés iniciar la recuperación desde «Olvidé mi contraseña» en la pantalla de ingreso. Si no podés continuar, contanos qué paso falla. Nunca te pediremos tu contraseña ni el código del autenticador por este chat."},
  {title:"Revisión de seguridad",area:"privacidad",text:"Hola {nombre}, recibimos el caso {caso} y lo derivaremos a la persona responsable. Antes de realizar cambios sensibles verificaremos la identidad por el procedimiento correspondiente. No envíes claves ni códigos por chat."},
  {title:"Reclamo recibido",area:"reclamos",text:"Hola {nombre}, registramos tu reclamo con el código {caso}. Vamos a revisar lo ocurrido y te responderemos en esta misma conversación. Conservá el código para identificar el seguimiento."},
  {title:"Arrepentimiento recibido",area:"arrepentimiento",text:"Hola {nombre}, recibimos tu solicitud de arrepentimiento {caso}. Revisaremos la contratación y el pago. Esta respuesta confirma la recepción; la resolución y cualquier devolución se informarán por separado después de verificarlas."},
  {title:"Derivación al responsable",area:"general",text:"Hola {nombre}, el caso {caso} requiere una revisión adicional. Lo estamos derivando a la persona responsable, que podrá consultar todo el historial. Te avisaremos cuando haya una respuesta."},
  {title:"Confirmar la solución",area:"general",text:"Hola {nombre}, ¿podés confirmar si el problema del caso {caso} quedó resuelto? Si continúa, respondé acá con lo que sucede y seguimos con la misma consulta."},
];
export function fillSupportReply(text:string, context:{name:string;code:string}) {
  return text.replaceAll("{nombre}",context.name).replaceAll("{caso}",context.code).replaceAll("{codigo}",context.code);
}
