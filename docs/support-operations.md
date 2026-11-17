# Atención del equipo y respuestas guardadas

Actualización: 17 de noviembre de 2026. No cambia precios, contratos, cobros ni el modelo comercial.

## Permisos

OWNER mantiene las operaciones del negocio. SUPPORT atiende consultas y consulta la ficha básica del cliente; ya no puede regalar Pro, suspender, quitar segundo factor ni cerrar sesiones. Su entrada al panel abre Conversaciones. Las pantallas de operaciones, comunicaciones, seguridad y actividad quedan fuera de ese rol tanto en navegación como en servidor. VIEWER conserva lectura de operaciones, sin facultad de atención ni mutaciones.

No se crean empleados ni se amplían permisos automáticamente. La lista de Google y ADMIN_EMAILS sigue siendo la autoridad. La asignación solo admite OWNER/SUPPORT activos.

## Atender y derivar

En el caso, Gestión interna permite seleccionar responsable y dejar una nota privada. Solicitar revisión interna cambia el estado a WAITING_INTERNAL y avisa al responsable, conservando el código y la conversación. Se rechaza una gestión si cambió la revisión del caso desde que se abrió.

Antes de escribir se pulsa Tomar para responder. La reserva dura 75 segundos, se renueva cada 25 segundos mientras la pestaña está visible y está ligada al caso, sesión administrativa y token de esa pestaña. Otra pestaña, incluso de la misma persona, no puede enviar. El token solo se almacena como hash. Los mensajes nuevos del cliente o cambios administrativos invalidan la reserva. El servidor comprueba también la revisión antes de confirmar la respuesta. Los borradores se conservan en memoria ante errores y actualizaciones de la vista; no sobreviven al cierre o recarga completa de la página y no se guardan en localStorage.

La reserva no reemplaza los controles de autorización ni la idempotencia del mensaje y del correo. La expiración permite recuperarse de una pestaña cerrada o caída. Las notas y las respuestas al cliente siguen siendo acciones distintas.

## Biblioteca de respuestas

Cada ticket ofrece búsqueda, motivo, vista previa e inserción en un borrador editable. Se priorizan respuestas generales y del motivo del caso; Todos permite consultar otras categorías. `{nombre}`, `{caso}` y `{codigo}` se completan como texto. Insertar no envía y agregar otra respuesta no reemplaza lo ya escrito.

La bandeja permite crear, editar o quitar respuestas compartidas, hasta 60. Se incluyen modelos prudentes de recepción, información adicional, pagos, baja, acceso, privacidad, reclamos, arrepentimiento, derivación y confirmación de solución. No confirman pagos, devoluciones o cambios de cuenta sin verificación humana. Se conservan las respuestas personalizadas anteriores; la biblioteca versionada permite también dejarla vacía. Ediciones concurrentes se serializan para evitar perder cambios.

## Avisos internos

AdminSupportNotice registra avisos propios por integrante para consultas nuevas, mensajes del cliente, asignaciones, revisión interna y demoras. El contador se actualiza cada 45 segundos cuando la pestaña está visible y al recuperar foco. Marcar vistos no consume avisos creados después de la pantalla abierta. Una respuesta del equipo despeja los avisos pendientes del caso.

Un caso sin asignar avisa a las personas activas de atención. Un caso asignado avisa al responsable; las novedades urgentes también al dueño. Los correos llevan solo código y enlace al panel, nunca el cuerpo de la consulta ni la identidad del cliente. Se agrupan por caso/destinatario en ventanas de 15 minutos y se usa la cola idempotente existente. Antes de entregar se comprueba que el destinatario siga autorizado y que el aviso siga vigente. No son marketing.

Las demoras se calculan con un objetivo interno de 8 horas de atención, lunes a viernes de 9 a 17 en America/Argentina/Buenos_Aires. No modifica las promesas comerciales de cada plan ni contempla feriados. Los días y horas del panel usan ese mismo huso. La detección acotada se ejecuta después del mantenimiento financiero ya programado, con presupuesto propio y fallo aislado; no cambia el resultado de conciliación. La entrega puede esperar el siguiente ciclo de correo. No agrega servicios pagos ni otra tarea programada.

## Publicación y reversión

La migración 20261116030000_support_operations agrega exclusivamente tablas de reservas/avisos, índices y relaciones con borrado en cascada desde el caso. No modifica registros financieros. Crear y verificar una copia cifrada antes de aplicarla. Ejecutar CI con PostgreSQL, tipos, regresiones y build; luego comprobar bandeja, roles, reserva, respuestas y pantallas móviles.

Conservar tablas y datos en una reversión. Priorizar revertir la presentación sin retirar la restricción de permisos. Si se desactiva temporalmente la coordinación de respuestas, limitar la atención a una sola persona hasta restaurarla. No restaurar una base anterior sobre pagos o consultas recientes.

Responder directamente a los correos de clientes sigue pendiente de conectar DNS y recepción, por decisión anterior del titular. El circuito actual vuelve al chat mediante un enlace y no depende de esa conexión.
