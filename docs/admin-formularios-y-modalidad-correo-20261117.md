# Formularios administrativos y modalidad de soporte

## Cambios

- Clasificación comercial: acción con confirmación visible, botón en fila independiente y bloqueo mientras guarda. Se conserva la autorización de dueño.
- Gestión del caso: selector controlado para evitar que el reinicio del formulario muestre Sin asignar después de guardar una asignación. Al guardar con éxito se limpian la nota y la casilla de revisión, conservando el responsable. Ante error se conserva el borrador.
- Responsable/notas y estado/cierre quedan en bloques diferenciados, con una columna en pantallas menores de 1100 px.
- Filtros: separación entre campos, casilla y botón; gastos previstos: concepto e importe en líneas distintas.
- Sistema informa la modalidad actual de chat con aviso por correo. Para indicar recepción habilitada comprueba también la presencia de la clave de lectura exigida por el endpoint.
- Los correos de soporte indican responder desde el enlace del caso cuando la recepción por correo está desactivada. El aviso se omite si en el futuro existe Reply-To de recepción habilitada.

## Verificación

- Navegador y base ficticia aislada: marcar cuenta interna, guardar, comprobar confirmación, recargar y confirmar persistencia. Resumen comercial pasa de un cliente a cero; el plan y el estado de la cuenta permanecen iguales.
- Asignar responsable y agregar una nota interna; volver a guardar sin nota; recargar y confirmar la asignación. No se envía respuesta pública ni se modifica ningún caso real.
- Pruebas enfocadas de soporte, concurrencia, métricas y comunicaciones: 20 correctas. Nueva regresión del aviso de responder por chat y su ausencia cuando existe Reply-To.
- TypeScript correcto. La revisión completa y compilación se ejecutan en CI antes de publicar.

## Decisión sobre recepción por correo

El titular eligió mantener por ahora las respuestas en el chat, después de revisar que Resend exige una clave de acceso completo a todos los dominios para leer mensajes. No se creó esa clave ni el webhook de Guafra. No se modificaron secretos ni variables de Vercel.

Antes de esa decisión quedaron preparados el subdominio `respuestas.somosguafra.com` en Resend, su registro TXT `resend._domainkey.respuestas` y un MX `respuestas` hacia `receive-sae1.forge.rmta.net`, prioridad 10 y TTL 3600. El dominio principal y sus registros de envío se conservaron. Resend confirmó la verificación de dominio; la importación de correos al panel sigue desactivada. La pantalla de Resend puede recibir mensajes de ese subdominio, pero Guafra no los importa ni anuncia esa dirección a los clientes.

Los formularios de creación de clave y webhook se cancelaron. Para una activación futura se requiere revisar de nuevo la autorización de ese permiso, configurar los secretos, verificar el MX y completar una prueba real de ida y vuelta. No se considera activado ni probado ese flujo.

Referencia de recepción: https://resend.com/docs/dashboard/receiving/custom-domains

## Reversión

Cambios sin migración. Se puede revertir el commit y republicar la versión anterior. La configuración de recepción en Guafra permanece desactivada durante todo este trabajo. Los registros DNS preparados no activan la importación ni afectan el correo del dominio raíz.
