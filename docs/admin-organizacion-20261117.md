# Organización del panel interno — 17 de noviembre de 2026

## Diagnóstico confirmado

- Consultas del sitio redirigía a Conversaciones y ambas contaban los mismos ContactMessage.
- Los chats derivados y los formularios se etiquetaban como Chat/contacto.
- La ficha del cliente mostraba todas las tareas y hasta 25 eventos en una sola página. Las tarjetas contiguas se estiraban con el historial.
- El detalle del caso apilaba mensajes, reserva, respuestas guardadas, redacción, responsable y cierre.
- Una tabla accesible posicionada como tabla absoluta producía desplazamiento vacío bajo los gráficos. Se conserva su contenido dentro de un contenedor visualmente oculto de altura limitada.

## Organización aplicada

| Sección | Vistas principales |
|---|---|
| Resumen | Evolución; activación y retención; distribución; atención |
| Clientes | Búsqueda y tabla; reserva Pro desplegable. Ficha: resumen, pagos, consultas, sesiones, actividad, administración |
| Cobros | Suscripciones; pagos; cupones |
| Conversaciones | Para el equipo; Solo bot. Formularios excluidos por relación real con ChatSession |
| Consultas del sitio | Bandeja y detalle propios; exclusivamente formularios sin ChatSession |
| Comunicaciones | Avisos; novedades; seguimiento; correos de servicio |
| Finanzas | Resumen; cobros; gastos pagados; previsiones; referencia de liquidación |
| Sistema | Estado y tareas; seguridad; problemas; recepción de correo |
| Actividad | Filtros y paginación de 30 registros |
| Equipo | Miembros; incorporación; sesiones; permisos |
| Ajustes | Sistema; planes y precios; contacto y redes |

Navegación agrupada en Negocio, Atención y Administración. Los enlaces antiguos a formularios conservan compatibilidad y redirigen a su detalle canónico de Consultas, con el mismo caso y código. No se duplican registros ni se migran datos.

## Conservación de controles

- Las pestañas mantienen montados los formularios para conservar borradores al cambiar de vista.
- Se conservan revisiones, reservas exclusivas, renovación de reserva, validaciones y permisos de las acciones.
- VIEWER consulta formularios, sin redacción ni controles de estado. No obtiene permisos de soporte.
- El historial tiene desplazamiento propio y abre en el mensaje más reciente, sin forzar el salto si se está leyendo más atrás.
- Las respuestas guardadas se despliegan a pedido. Elegir un borrador no envía mensajes.
- No cambian importes, comisiones, suscripciones, estados de pago ni permisos del equipo.
- No se activa cierre automático de casos. Esa política permanece pendiente de aprobación.

## Verificación

- Pruebas de integración: separación de bot, derivación, formulario y Ayuda anterior; filtros y paginación sin duplicados; contadores concordantes.
- Regresión de chat, reservas, concurrencia y permisos: 30 pruebas correctas en el grupo enfocado.
- Navegador con PostgreSQL compatible en memoria y proveedores desconectados: 28 formularios, un chat derivado, otro automático, 35 mensajes y 45 eventos ficticios.
- Recorrido de las once secciones en escritorio y ancho de 390 px. Sin desbordamiento horizontal de página.
- Borrador conservado al alternar entre conversación y gestión del caso; reserva liberada sin enviar.
- Página 2 de Consultas permanece en su bandeja y conserva filtros y contador.
- VIEWER abrió un formulario real de la base ficticia: cero botones de respuesta y cero selectores de estado.
- Resumen en escritorio: altura de documento reducida de 1916 a 900 px en la misma ventana, conservando los datos accesibles.
- Capturas de demostración en .data/chat-qa; no contienen información de clientes reales.

## Límites y reversión

La ficha conserva vistas recientes de 12 pagos, 10 consultas y 25 eventos, identificadas como tales. La búsqueda de Clientes conserva su límite anterior de 200 candidatos. Las bandejas tienen paginación de 25. El historial de un caso conserva todos sus mensajes; el límite visual no supone paginación de la consulta de mensajes. Para historiales extraordinariamente grandes conviene paginar también esa consulta.

No hay cambios de esquema ni migración. Se puede revertir el commit y publicar la versión anterior, manteniendo todos los datos; las rutas antiguas siguen disponibles. Cualquier implementación futura de cierre automático o recepción de respuestas por correo se hará por separado.
