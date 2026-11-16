# Pendientes y aceptación de la publicación

Fecha: 16 de noviembre de 2026. Complementa el diagnóstico histórico; prevalece para el estado de verificación posterior a las correcciones.

## Evidencia cerrada antes de promover

- PR: https://github.com/fraanbosshardt-dot/somosguafra/pull/1
- CI aislado con PostgreSQL16: https://github.com/fraanbosshardt-dot/somosguafra/actions/runs/43821242783
- 445 pruebas aprobadas, 62 archivos; incluidas las dos pruebas multiconexión antes omitidas localmente. Migraciones, tipos, build y smoke HTTP aprobados.
- Copia de producción de solo lectura, 55 tablas, cifrada y autenticada al volver a abrirla. No se restauró producción ni se imprimieron registros. Clave protegida con Windows DPAPI del usuario actual, separada de la copia y fuera de Git. No sustituye una copia externa ni demuestra un RTO productivo.
- Railway muestra que el volumen no tiene backups del proveedor; crear copias programadas/PITR exige Pro en el plan mostrado. No se contrató ni modificó el plan.
- Vercel comparte DATABASE_URL entre Production y Preview. Se deshabilita únicamente el auto-despliegue de esta rama en vercel.json; main conserva su comportamiento. No se abrieron ni copiaron los valores secretos desde Vercel.

## Prioridad alta: operación y aceptación externa

1. **Respaldo recurrente y recuperación:** elegir y configurar custodia fuera del equipo, frecuencia, retención, alertas y prueba de recuperación aislada. La clave DPAPI actual depende del usuario/equipo Windows: no es una estrategia de recuperación ante pérdida de ambos. Definir RPO/RTO; evaluar backup nativo/PITR o proceso externo cifrado sin contratar nada automáticamente.
2. **Separar staging/preview de producción:** DB, secretos, correo y pasarela aislados. No habilitar la preview de esta rama mientras siga compartiendo DB. El build habitual aplica migraciones: no usarlo como prueba contra producción.
3. **Aceptación oficial de Mercado Pago en sandbox:** alta, rechazo, pendiente, renovación, baja, cambio mensual/anual, checkout abandonado y navegador cerrado. Los tests actuales simulan el proveedor; no certifican el transporte externo. No usar cobros, bajas o reembolsos reales como prueba.
4. **Alertas operativas externas:** GitHub no tenía secretos configurados al comprobarlo. Cargar CRON_SECRET de forma segura para el monitor autenticado; elegir responsable/canal y comprobar que las alertas llegan. Verificar ejecución real del cron de cobros y edad del backlog. El panel por sí solo no avisa a nadie.
5. **Correos transaccionales reales:** validar remitentes, entrega, rechazos y deduplicación con destinatario autorizado. Revisar manualmente cualquier outbox uncertain: no reenviar sin confirmar el resultado con Resend. Accepted/sent no demuestra entrega al buzón.

## Prioridad media: experiencia, seguridad y rendimiento

6. **Aceptación visual y accesibilidad:** landing, autenticación, continuación de compra, Mi plan, trial, estados pendientes y panel admin; móvil/escritorio, teclado, foco, zoom, lector de pantalla y errores. La vista local fue bloqueada por revisión automática; no se presentó como inspeccionada.
7. **Aceptación de roles por HTTP/navegador:** propietario, miembro, sesión sin2FA, suspendido, revocado y otro espacio. Hay pruebas de servidor y smoke anónimo; falta recorrido integral de cada identidad con datos ficticios.
8. **PDF en runtime serverless:** worker/parser con PDF sintético en entorno aislado. El build incluye sus159archivos/metadatos y las pruebas locales pasan, pero eso no sustituye probarlo en Vercel. El límite de heap del worker no es un sandbox del sistema operativo.
9. **Medición de rendimiento y capacidad:** CWV (LCP/INP/CLS), latencia, consultas/pool, memoria y cola de conciliación con carga representativa. No hubo prueba a1000/10000/100000usuarios. Ajustar lotes/colas según evidencia; no prometer capacidad ilimitada.
10. **Seguridad de infraestructura:** MFA/accesos del equipo, privilegios, gestión y rotación planificada de secretos, transporte autenticado, configuración efectiva de proveedores y revisión de dependencias periódica. No rotar AUTH_SECRET a ciegas porque protege datos y firmas existentes. La revisión no es un pentest externo completo.
11. **Información al consumidor y privacidad:** validar con profesional textos y procedimientos reales de baja, arrepentimiento, retención/anonimización y tratamiento de datos. La facturación fiscal quedó excluida por instrucción del titular; no se asume resuelta ni se implementa por esta checklist.

## Evolutivos y aplazados

12. **Soporte por respuesta al correo:** sigue aplazado por decisión del titular. Faltan recepción, DNS, webhook y prueba de hilo; formularios/hilos web existen. No prometer recepción de respuestas a un buzón todavía no conectado.
13. **Analítica y costos verificables:** embudo visitante→registro→activación→checkout→primer pago, cohortes de trial, uso de funciones y motivos de baja. Completar costos reales de infraestructura/soporte y alertas de consumo; no inventar LTV/CAC ni tratar MRR como caja disponible.
14. **Más automatización de aceptación:** E2E de regresión por roles y contratos externos, cobertura instrumentada y lint mantenible. Priorizar dinero/acceso/datos; no agregar tests que solo repitan la implementación.
15. **Cambios comerciales nuevos:** anual→mensual directo, prorrateos, cambios de medio de pago integrados, chat/bot y nuevas campañas requieren diseño/alcance propio. No forman parte del flujo aplicado ni deben presentarse como funciones terminadas. No se activó marketing por correo.

La promoción final y el resultado del despliegue deben comprobarse en el estado de la PR, Vercel y el dominio. Una autorización para publicar no autoriza transacciones reales ni cambios de precio/contrato de clientes.
