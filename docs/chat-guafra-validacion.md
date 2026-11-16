# Verificación del chat Guafra

16 de noviembre de 2026. Verificación local con cuentas, mensajes y base PostgreSQL PGlite sintéticos. Sin cobros, cancelaciones, devoluciones o correos reales.

## Ejecutado

- Suite general: 67 archivos aprobados, 1 omitido; 475 pruebas aprobadas y 2 omitidas. Las omitidas requieren PostgreSQL externo para concurrencia y se ejecutan en CI.
- Regresiones posteriores: 46 pruebas aprobadas sobre chat, bandeja, exportación, eliminación de datos, correo y administración; luego 38 pruebas aprobadas incluyendo los 4 casos específicos del retorno desde correo.
- TypeScript: aprobado después de los cambios finales.
- Migración ejecutada en las bases locales de integración, con ticket de compatibilidad escrito como la versión anterior.
- Build Turbopack local: bloqueado por la junction de node_modules hacia el checkout principal, no por un diagnóstico de código. La comprobación definitiva con instalación normal se realiza en CI; también se verifica la compilación local con webpack. No se alteró la configuración productiva para acomodar la junction.

## Recorrido por navegador

1. Landing: botón Guafra, preguntas rápidas y escritura libre.
2. Pregunta frecuente: respuesta preparada, identificada como automática y enlace oficial.
3. Problema de cobro: derivación al equipo; no cambia estados de pago.
4. Visitante: nombre y correo, mismo código e historial después de derivar.
5. Panel: caso visible, asignación, nota interna y respuesta humana.
6. Cliente: la respuesta aparece en el mismo chat; la nota interna no aparece.
7. Nuevo mensaje: reabre el caso, sin duplicar la consulta.
8. Cuenta autenticada: chat disponible dentro de la app móvil.
9. Enlace de correo: `/soporte/abrir?caso=...` vuelve al dominio configurado, conserva sesión y abre automáticamente la conversación correcta en Ayuda.
10. Vista de 390 × 844: lectura, escritura y controles accesibles; código y estado fuera del área de mensajes para que permanezcan visibles.

Evidencias locales en `.data/chat-qa/` (solo datos ficticios). No se afirma entrega de email a partir de esta prueba: Resend estuvo deshabilitado. Se comprobó el registro transaccional e idempotente del aviso y su enlace.

## Cobertura automática relevante

Aislamiento entre visitantes/cuentas, segundo factor, código sin valor de credencial, enlace firmado y expiración, CSRF por origen, JSON inválido y límite de cuerpo, errores sin credenciales, reintentos concurrentes, derivación única, prioridad de urgencias posteriores, edición/desactivación de guías, límites de conversación, paginación sin notas internas, conservación del historial durante sondeo, compatibilidad de migración, exportación sin secretos/notas y borrado de chats vinculados.

Los cambios administrativos de estado rechazan una versión desactualizada del caso para no cerrar mensajes nuevos sin revisar.

## Antes de producción

Revisar el resultado de CI y el PR. Crear y verificar un respaldo cifrado. Solicitar autorización de publicación si no fue concedida específicamente. Aplicar la migración con el despliegue habitual y comprobar disponibilidad, chat y una entrega de correo autorizada.
