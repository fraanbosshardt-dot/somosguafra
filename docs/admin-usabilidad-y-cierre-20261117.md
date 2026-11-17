# Panel y gestión de consultas — 17/11/2026

## Diagnóstico y alcance autorizado

Revisados código y pantallas de Resumen, Clientes, Cobros y cupones, Conversaciones, Consultas del sitio, Comunicaciones, Finanzas, Sistema y seguridad, Actividad, Equipo y Ajustes. Consultas del sitio redirige a la bandeja con el canal correspondiente. Se revisaron además ficha de cliente, biblioteca desplegada de respuestas y detalle de caso. Datos ficticios, sin ejecutar cobros ni cambios sensibles.

Hallazgos visuales: los desplegables nativos no tenían un espaciado uniforme al abrir; las filas podían mantener acciones al lado de un formulario expandido; formularios de grilla estiraban Guardar a todo el ancho; el estado «Esperando tu respuesta» era ambiguo dentro del panel; las métricas se repartían en filas incompletas; navegar desde abajo podía dejar el título debajo de la barra fija.

La captura aportada por el usuario muestra además dos áreas desplazables al pedir asesor: `GuafraChat` dejaba visible el feed y colocaba el formulario de derivación como hermano flex. El feed queda oculto mientras se completa la solicitud; el formulario ocupa su espacio, con un único desplazamiento y título enfocado. Volver conserva la conversación y el historial se deriva completo. No cambia el alta de casos ni el correo.

## Cambios de presentación

- Ritmo común de tarjetas, explicaciones, campos y botones; acciones que se acomodan y saltan de línea.
- Desplegables separados del contenido, y formulario expandido con espacio propio.
- Métricas: hasta cuatro columnas (tres cuando son seis indicadores), respetando los diseños de Finanzas y móvil.
- Navegación entre secciones vuelve al inicio por navegación interna; no fuerza el scroll al usar Atrás.
- Caso con accesos Historial / Responder / Estado y cierre; notas internas claramente identificadas.
- Etiqueta «Esperando al cliente» exclusiva del administrador. La etiqueta del cliente se conserva.
- Acciones frecuentes de actividad con descripción legible.
- Formulario de asesor como vista propia dentro del chatbot, sin mostrar fragmentos de mensajes anteriores ni dos barras de desplazamiento.

## Funcionamiento actual confirmado por código

- `handoffChat` crea una consulta asociada al mismo código y vincula los mensajes existentes. Se atiende desde Conversaciones; no contrata ni contacta a un asesor externo.
- `CaseTools` permite asignar el responsable a un miembro activo de atención. «Tomar para responder» reserva la edición temporalmente, no cambia por sí mismo el responsable permanente.
- `replyToContact` / `replyToTicket` guardan respuesta pública y correo en la misma transacción y dejan `ANSWERED`. Para chats vinculados, el correo avisa y enlaza al caso.
- `updateSupportCase` permite cerrar o resolver manualmente, preservando el historial. `customerReply` reabre el mismo caso si la persona vuelve a escribir.
- `botChatStatus`: una sesión exclusivamente automática se considera finalizada tras 30 minutos sin actividad. No cierra casos humanos.
- No hay cierre por inactividad para casos humanos. No se incorporó en esta entrega.

## Propuesta pendiente de aprobación

1. Separar acciones «Responder y esperar al cliente», «Responder y seguir en revisión» y «Responder y resolver». Una respuesta intermedia no debe habilitar un cierre automático por error.
2. Mantener responsable, prioridad y notas privadas en el mismo caso. El dueño puede atender o asignar a otro miembro; revisión interna conserva el código.
3. Para consultas generales de uso de la app, solo cuando se pide información al cliente: un recordatorio a las 72 horas sin respuesta y cierre por inactividad a los 7 días desde la última respuesta pública que solicitó información. Avisar al cliente al cerrar; no marcarlo como solucionado.
4. Nunca autocerrar mientras el equipo deba responder o esté investigando. Excluir pagos, cobros, reembolsos, privacidad, seguridad, reclamos y arrepentimiento; cierre humano con motivo.
5. Si el cliente continúa por el mismo problema, reabrir el caso y avisar al responsable. Un tema diferente puede tener código nuevo. No eliminar el historial.
6. Recordatorios idempotentes y cierre transaccional: revalidar último mensaje y estado para que una respuesta simultánea impida el cierre. Cada nueva espera reinicia el plazo. Respetar la disponibilidad de la tarea programada; el plazo no es promesa al minuto exacto.
7. Mostrar «Cerrado por inactividad» separado de «Resuelto», y medir por separado falta de respuesta del cliente y resolución real.

No se activan automatizaciones ni se envían recordatorios nuevos sin aprobación de esta propuesta.

## Verificación y reversión

TypeScript y regresión de permisos, reservas y administración de casos. Revisión local de todas las secciones en escritorio y a 390 px, además del detalle y desplegables. No escribir tests que solo comparen propiedades CSS. CI completo y build antes de publicar. Sin migración ni cambios en datos o estados de casos reales. Reversión mediante revert del commit; no requiere restaurar la base.
