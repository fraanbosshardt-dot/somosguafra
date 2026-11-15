# Suscripciones, seguimiento, Finanzas y soporte

Implementación del 15 de noviembre de 2026. Conserva las secciones actuales del panel.

## Acceso y contratación

- Landing sin fechas de trial ni solicitudes pendientes. Selector mensual/anual disponible; detalles de cuenta en Mi plan.
- Mi plan presenta el período gratuito con una fecha legible. La elección lleva a `/app/contratar`, con importe total, frecuencia, comienzo y condiciones antes de un POST hacia Mercado Pago.
- El mismo intento pendiente se retoma con su importe original. Otro ciclo exige confirmación expresa del intento a reemplazar, verifica identidad/referencia/estado y ausencia de actividad de pago, confirma su cancelación y vuelve a comprobar actividad antes de crear el nuevo.
- Una autorización concurrente impide el reemplazo. Si aparece un pago durante el cambio, se concilia y no se genera un nuevo contrato. No se cancelan contratos activos para resolver un intento abandonado.
- Una respuesta incierta bloquea un nuevo alta hasta reconciliarla. La recuperación de múltiples coincidencias exige revisión; no cancela acuerdos a ciegas.
- Se mantienen las reglas existentes de trial, acceso por pagos, renovación y regreso a la app. El regreso del navegador no prueba un pago aprobado.

## Métricas

- Pagadores demostrados por períodos aprobados o cobertura histórica identificada; cancelaciones de intentos sin pagar no entran en pérdida de pagadores.
- Pérdida de pagadores: espacios con cobertura paga al inicio de los últimos 30 días que ya no la tienen al cierre. Una renovación desactivada con cobertura vigente se muestra aparte. Sin base inicial: No aplica.
- MRR según el importe del acuerdo vigente; los importes faltantes se indican por conciliar. No se usa el catálogo actual para revalorizar contratos anteriores.
- Trials, concesiones y cobertura histórica no demostrada se distinguen. No se modifica el estado del proveedor para arreglar estadísticas.
- Marca manual de cuenta interna/de prueba por espacio; no se infiere del correo. Se excluye de métricas comerciales y de los avisos de fin de acceso gratuito.
- Embudo por cuentas titulares; actividad diaria mínima para D7/D30 desde esta versión, sin inventar actividad histórica. Se cuentan días completos de Argentina. No se guardan montos personales en esos eventos.
- Filtros de clientes por trial, intento pendiente, renovación desactivada, cuenta interna e inactividad; ficha con hitos de alta, verificación, bienvenida y primera acción.

## Finanzas

- Neto informado, cargos del pago, datos de liberación y última sincronización se obtienen de la consulta autenticada del pago. Ausencias no equivalen a cero.
- Libro de eventos de cobro, devolución y contracargo con claves idempotentes. Un reembolso posterior no borra el ingreso del mes original. La reconstrucción histórica marca fechas de devolución estimadas cuando no existe la fecha exacta.
- Separación de bruto, devoluciones, neto informado y liberaciones; acumulado liberado no es saldo de billetera ni transferencia al banco.
- Gastos pagados por fecha y gastos fijos proyectados separados. Finalizar una previsión no borra el registro histórico. La pantalla no presenta cobros menos gastos actuales como ganancia contable histórica.
- Exportación CSV protegida por rol de dueño, con protección de fórmulas y auditoría. Detalle en pantalla limitado a 200 registros; totales consultan el historial completo.
- Referencia del titular: 18 días; comisión informada 3,55%; ejemplo de neto 7.176,54 sobre 7.499. Este ejemplo implica aproximadamente 4,30% total. Se usa esa tasa total solo para estimaciones, editable en Finanzas. No se afirmó haber verificado la configuración dentro de Mercado Pago ni se cambió su comisión/plazo.
- La integración no consulta movimientos externos de billetera ni extractos bancarios y no emite facturas ARCA. La pantalla indica estas diferencias. Las conversiones históricas de moneda no ARS son estimaciones con tipo de cambio de referencia actual.

## Atención y correos

- Hilo común de mensajes para Ayuda y Contacto, conservando las dos vistas del panel. Respuestas anteriores se conservan, incluidas las existentes antes de esta versión.
- Cliente puede responder/reabrir su caso desde Ayuda. Visitantes reciben por correo un enlace privado firmado, vinculado al caso y al correo y con vencimiento de 90 días.
- Notas internas no aparecen en el seguimiento del cliente ni en correos. Asignación al integrante del equipo y desasignación auditadas. Las respuestas guardadas continúan disponibles.
- Respuesta y correo se encolan en una transacción; reintentos deduplicados. La misma respuesta puede enviarse legítimamente después de un nuevo mensaje del cliente.
- Límites de mensajes por caso y de nuevas consultas. La guía automática usa respuestas preparadas, permite derivar a una persona y no ejecuta acciones financieras ni pide secretos.
- Comunicaciones muestra segmentos de seguimiento y estado de correos transaccionales. Aceptación del proveedor no se confunde con entrega en la bandeja.
- Avisos factuales del fin del período gratuito: deduplicados y comprobados otra vez antes de enviar. Se omiten si cambia el estado o el destinatario. No se activan campañas de recuperación, promociones ni email marketing.

## Pendiente por decisión del titular: recepción por correo

El titular pidió el 15/11 dejar esta conexión para más tarde. No se tocaron DNS, recepción de Resend ni variables externas para habilitarla. Las conversaciones y enlaces web funcionan; responder directamente a un correo todavía no ingresa al panel.

Preparado y desactivado por defecto:

- Endpoint `POST /api/webhooks/resend`, con firma Svix del cuerpo original, validación de caso/remitente, deduplicación, rechazo de autorrespuestas y límites.
- Recuperación del cuerpo de correo desde Resend después de verificar la notificación. No se descargan adjuntos automáticamente.
- Reply-To individual por caso solo cuando la recepción está explícitamente habilitada.

Pasos pendientes:

1. Iniciar sesión en Resend y Hostinger; elegir subdominio de recepción y copiar exclusivamente los registros que muestre Resend para ese dominio. No reemplazar MX del dominio raíz.
2. Verificar recepción; configurar webhook para `email.received` hacia el endpoint de producción.
3. Guardar en Vercel la clave de lectura de recepción y el secreto de firma, sin exponerlos en código o registros.
4. Configurar `SUPPORT_RECEIVING_DOMAIN`, `RESEND_RECEIVING_API_KEY`, `RESEND_WEBHOOK_SECRET` y, al finalizar las verificaciones, `SUPPORT_INBOUND_ENABLED=true`.
5. Redeploy y prueba de ida y vuelta con destinatario autorizado, verificando el mismo caso, notas privadas y ausencia de bucles. Hasta entonces mantener desactivado.

Identidades propuestas para esa etapa: soporte, pagos y seguridad. Una identidad de envío no crea un buzón atendido; la recepción y los responsables deben quedar configurados.

## Validación

Pruebas con PostgreSQL local aislado, proveedor simulado y cuentas ficticias. Verificación de ciclos, reintentos, cobertura, cancelación, devoluciones, métricas, firma de webhook y casos privados. Revisión visual en escritorio y móvil; no se ejecutó ningún cobro real. La validación de una operación real de extremo a extremo continúa pendiente, por decisión previa de no realizarla.
