# Chat Guafra: operación y publicación

## Alcance

Asistente con respuestas preparadas sobre el producto y derivación al equipo. No contrata IA externa ni modifica pagos, planes, accesos, contraseñas o datos financieros. No envía marketing.

Se presenta como Guafra en las páginas públicas, acceso y app. El cliente conserva la misma conversación durante la atención humana. Cada conversación tiene código SG; ese código es una referencia, nunca una credencial.

## Modelo

ChatSession identifica la conversación automática y su propietario (cuenta o hash de cookie aleatoria HttpOnly). Al derivar, se crea un ContactMessage existente con el mismo código. SupportMessage guarda mensajes públicos, del bot, del equipo y notas internas. Las bandejas no crean otro caso al responder.

Estados humanos: OPEN → IN_PROGRESS / WAITING_INTERNAL → ANSWERED → RESOLVED / CLOSED. Un nuevo mensaje del cliente reabre OPEN. Los cambios administrativos verifican la versión para impedir cerrar una consulta que recibió mensajes mientras se revisaba. La resolución del bot no puede cerrar un caso humano.

Los reintentos de mensajes y respuestas usan claves de deduplicación. La derivación bloquea la conversación y es idempotente. Límites compartidos en PostgreSQL restringen abuso por identidad e IP.

## Atención

En Admin → Conversaciones se buscan códigos, nombres, correos y asuntos; se filtra por estado, canal, motivo y responsable. Se ven las consultas anteriores y los formularios del sitio junto con los chats derivados. Consultas del sitio abre esa misma bandeja filtrada. Las conversaciones automáticas sin derivar se consultan con su filtro específico.

El equipo puede asignarse una consulta, escribir notas privadas, responder, cambiar prioridad, resolver y reabrir. La vista se actualiza cada 20 segundos si no se está escribiendo. El cliente recibe actualizaciones cada 15 segundos únicamente mientras el chat está abierto y la pestaña visible.

Solo el dueño administra los textos automáticos en `/admin/soporte/respuestas`. Los enlaces son rutas oficiales fijas y los reclamos económicos o de seguridad siguen derivándose aunque se editen las guías. Soporte: lunes a viernes, 9 a 17 h, Argentina; no se promete una persona en línea las 24 horas.

## Correo

Una respuesta humana en chat guarda, en la misma transacción, un aviso en EmailOutbox. El correo contiene código y enlace, sin copiar el contenido privado de la respuesta. Resend usa el circuito transaccional e idempotente existente. Si falla, la respuesta sigue guardada y el envío se reintenta.

Cuenta: `/soporte/abrir?caso=...` exige sesión y segundo factor cuando corresponde. Visitante: enlace privado firmado a `/consulta/...`, vigente 7 días; el código solo no abre el caso. Los avisos formales de arrepentimiento, privacidad y reclamos también conservan constancia por correo. Registrar el caso no confirma una baja o devolución.

Responder directamente al correo sigue pendiente de conectar DNS y webhook de recepción, por decisión del titular. El flujo de este cambio usa el botón para volver al chat; no depende de esa conexión pendiente. No se configuraron nuevas credenciales.

## Privacidad

El servidor controla la propiedad en cada lectura y escritura, sin vincular una conversación por el correo que alguien diga tener. Una sesión con segundo factor incompleto no abre casos de la cuenta. El chat de visitante se mantiene como tal; si luego ingresa a una cuenta, su caso de visitante se continúa desde el enlace privado original.

Las notas y autores internos no llegan al cliente. HTML aportado por personas se muestra como texto. El widget no guarda mensajes ni credenciales en localStorage. La cookie técnica dura hasta 30 días. Las conversaciones automáticas sin derivación se depuran después de 30 días de inactividad; los casos humanos conservan su historial. La exportación incluye mensajes públicos y excluye hashes de acceso y notas internas. Borrar una cuenta limpia sus chats vinculados sin alterar la conservación del registro contable existente.

## Publicación controlada

1. Revisar PR y CI (tipos, migración en PostgreSQL, regresiones y build).
2. Crear y verificar un respaldo cifrado separado antes de migrar producción.
3. Publicar solo con autorización. La rama `feat/guafra-chatbot` tiene los previews automáticos deshabilitados: no ejecutar migraciones de prueba sobre la base productiva.
4. La migración es aditiva: incorpora ChatSession y campos de mensajes/códigos. Un valor por defecto de base permite que la versión anterior siga creando tickets durante el cambio.
5. Verificar landing, acceso, app móvil, bandeja, respuesta, enlace de retorno y estado operativo. No ejecutar cobros ni cancelaciones para probar el chat.
6. Revisar la cola de correo y una entrega autorizada; una prueba local sin Resend verifica la cola, no demuestra entrega real.

## Reversión

Revertir el commit de aplicación y redesplegar. Conservar las tablas y mensajes nuevos; no ejecutar DROP ni restaurar toda la base sobre datos recientes. Las entradas derivadas siguen siendo ContactMessage y su historial se conserva en SupportMessage. Durante una reversión, revisar la eliminación de cuentas antes de habilitar ese proceso, porque la versión anterior no conoce la limpieza adicional de contactos del chat. Si se requiere, mantener el backend nuevo y retirar temporalmente solo los puntos de entrada del widget en una corrección separada.

## Límites de esta versión

Atención por texto, sin adjuntos, llamadas ni un modelo generativo. No afirma conocer el estado de un cobro por lo escrito en el chat. No es un monitor de presencia en tiempo real ni garantiza horarios de respuesta fuera del servicio informado. Las conversaciones recientes se listan con límites; los casos anteriores pueden abrirse por su código autorizado o enlace privado, y los mensajes anteriores se paginan.
