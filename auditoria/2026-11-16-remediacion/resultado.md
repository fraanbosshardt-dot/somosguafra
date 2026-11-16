# Correcciones controladas de somosguafra

Rama: `fix/auditoria-integral-20261115`. Base: `d05880e`. Autorización: implementar las correcciones del diagnóstico, con pruebas y sin desplegar. Este documento incorpora también la solicitud posterior de contratación directa desde la landing.

Estado: cambios de código y migración preparados localmente. No se publicaron en GitHub, Vercel, Railway ni otros proveedores. No se cobraron, cancelaron ni reembolsaron operaciones reales. Las transiciones de pago de las pruebas son objetos ficticios y respuestas interceptadas.

## Flujo de contratación resultante

| Estado comprobado por el backend | Acción desde la landing |
|---|---|
| Sin sesión | Conserva ciclo e importe mediante intención firmada de30min; registro o ingreso; continúa tras autenticación |
| Falta segundo factor o correo confirmado | Completa la verificación obligatoria y conserva la elección; no crea un contrato todavía |
| Gratis/trial, sin contrato ni pago pendiente | POST explícito directo a `startCheckout` y redirección a Mercado Pago; no abre la configuración ni el resumen privado |
| Checkout creating/uncertain/pending | Mi plan; no reemplaza ni genera otro intento automáticamente |
| Pago pending/in_process/authorized | Mi plan; incluso con contrato cancelado, el motor bloquea una contratación nueva hasta resolver el cobro |
| Contrato autorizado/pausado o renovación fallida | Mi plan, sin pedir otro pago |
| Cobertura paga vigente o Pro permanente | App/Mi plan; no genera otro contrato desde la landing |
| Contrato cancelado/vencido, sin cobertura ni cobros por resolver | Puede contratar nuevamente, sin revivir un contrato cancelado |
| Cotización vencida o precio cambiado | Revisión explícita del precio vigente; no acepta silenciosamente un importe mayor |

El historial de haber pagado no es autoridad suficiente para renovar ni para impedir una nueva contratación. Se verifican contrato, cobertura, intentos y pagos pendientes por separado. Un cambio mensual→anual de una suscripción existente sigue siendo una gestión expresa dentro de Mi plan.

`landingCheckoutAction` es el POST del botón público; `landingPurchase` centraliza la política de navegación y reutiliza el motor existente. Tras autenticar, `/continuar-compra` es una transición pública mínima que envía automáticamente un POST únicamente si existe la intención firmada. Ni esta página ni `GET /suscribirme` crean contratos. La intención se limita al mismo navegador durante30min; si vence o cambia el precio, se pide revisión.

El backend vuelve a calcular precio, rol, espacio, estados y cobertura. El retorno del navegador no activa pagos. La activación sigue dependiendo del proveedor consultado desde webhook/conciliación. La landing muestra frecuencia, renovación y conservación del período gratuito; los detalles personales permanecen en Mi plan.

## Correcciones y evidencia

| Hallazgo | Corrección | Archivos / regresiones |
|---|---|---|
| FIN-01 / PAG-01 | Borrado elimina usuario, miembros y finanzas personales. Si existe historial empresarial, conserva un registro técnico de Workspace sin miembros y con nombre neutro, junto con acuerdos/facturas/eventos. No recrea suscripción al recibir devolución tardía | `admin-accounts.ts`, `billing.ts`, `schema.prisma`; `billing-retention.test.ts`, `billing.test.ts` |
| FIN-02 / PAG-02 | MRR selecciona contrato vigente por providerRef, independientemente del intento anual. Archivados no cuentan como clientes activos; se conserva historia económica/cohorte | `admin-metrics.ts`; `admin-audit-regressions.test.ts`, `business-finance.test.ts` |
| PAG-03 | Evento canónico de baja para acción/webhook/cron. No anuncia baja completa mientras existan otros acuerdos sin detener | `billing.ts`, `billing-mail.ts`; `billing.test.ts`, `billing-mail.test.ts` |
| PAG-04 / OPS-01 | Cursor durable por pago, presupuesto propagado a consultas remotas/transacciones y reanudación. Se priorizan intenciones de cancelación y se mide antigüedad de conciliación | `billing.ts`, migración; `billing-state-regressions.test.ts` |
| PAG-06 | Intención se confirma antes de cancelar externamente. Cambio de ciclo y descarte separan pasos remotos de la transacción local. Compensación también tiene intención durable. Un switch fallido no deja orden de cancelar después el mensual que sigue vigente | `billing.ts`; `billing.test.ts`, incluido fallo DB después del PUT |
| PAG-07 | Outbox con lease por token, primer intento, estados queued/sending/sent/suppressed/uncertain. Ventana automática conservadora20h; después requiere revisión. Revalida estado y destinatario. Migración distingue omisiones antiguas de envíos aceptados | `billing-mail.ts`, `operations.ts`, UI; `billing-mail.test.ts`, `audit-migration.test.ts` |
| PROD-01/02 | Etiquetas de estados completas, totales mediante counts independientes, paginación de suscripciones/pagos | `admin-billing-report.ts`, `payment-labels.ts`, `/admin/cobros`; `admin-audit-regressions.test.ts` |
| SEC-01/05 | Cuotas compartidas atómicas por usuario/IP, login/registro/reset/códigos. Activar/quitar2FA y generar recuperación requieren sesión reciente cuando corresponde. Código TOTP de un solo uso; activar2FA revoca otras sesiones previas | `security-limits.ts`, `totp-check.ts`, acciones de auth/app/recovery; `security-actions.test.ts`, `security-remediation.test.ts` |
| SEC-02 | Verificación/HMAC no firman con secreto vacío/débil. El pago exige correo confirmado aunque Resend esté temporalmente deshabilitado | `auth/secret.ts`, `email-verify.ts`, `account-mail.ts`, `support-thread.ts`, acciones de pago |
| SEC-03 | Backup AES-256-GCM con clave independiente, compresión y autenticación; no existe fallback a texto plano. Restore exclusivamente local, destino vacío, comprobación de estructura/FKs/filas y transacción completa | `backup.ts`, `backup-store.ts`, scripts backup/restore; `backup.test.ts` |
| SEC-04 | Usuario/espacio/categorías se crean en una transacción. Reparación idempotente de altas antiguas sin membresía | `workspace.ts`, `google-auth.ts`, `auth.ts`; `security-remediation.test.ts` |
| SEC-06/07 | Exportación incluye respuestas públicas, excluye notas internas y entrega facturación únicamente al dueño del espacio | `admin-accounts.ts`; `security-remediation.test.ts` |
| SEC-08 | Google verifica JWS RS256 con claves del JWKS oficial, claims, caché acotada, renovación y timeout; no acepta jku del token | `auth/google.ts`, callback; `google.test.ts` |
| SEC-09 | Reserva de cuota PDF antes del parseo, libera errores y consume éxito una vez. Worker separado con timeout, límite de heap, páginas/texto/items y cleanup. Parser y metadatos incluidos explícitamente en artefactos serverless | `pdf-quota.ts`, `pdf-worker.ts`, `statement-pdf.ts`, `modules.ts`, `next.config.ts`; `pdf-quota.test.ts` |
| OPS-02 | Detector examina todos los espacios mediante consulta SQL, sin recorte de1000. Agrega contratos múltiples, bajas y entregas inciertas | `operations.ts`; `maintenance.test.ts` |
| OPS-04 / MAINT-01 | CI preparado con PostgreSQL real aislado, pruebas de dos pools, migración, tipos, suite, build y smoke HTTP. Monitor preparado cada5min y chequeo autenticado si se carga el secreto correspondiente | workflows CI/salud, `postgres-concurrency.test.ts`, `check-build.mjs` |
| PERF-01/02/03 | Retención con Set, consulta de cobertura/historia acotada, tasas FX por informe y reutilización de pendientes de Inicio por petición. Los CTAs comparten solo la petición de plan en vuelo, sin caché persistente de cuentas | `admin-metrics.ts`, `company-finance.ts`, `ledger.ts`, Inicio, `app-cta.tsx` |
| UX-01/03/06 | Modal con foco inicial seguro, confinamiento, fondo inert y prevención de doble submit; confirmación de baja admin y enlace de salto al contenido | `confirm-submit.tsx`, `/admin/cobros`, PublicShell/CSS |
| UX-02/04/05 / PAG-05 | Aviso compartido duplicado eliminado, FAQ actualizada, historial paginado en Ayuda/Plan/Finanzas/Soporte/Consultas; ayuda oficial del proveedor para revisar medio de pago | páginas y componentes de producto; `admin-audit-regressions.test.ts`, `plan-subscription-card.test.ts` |
| MAINT-02 | Retirados catálogo/toggle obsoletos sin consumidores | `modules.ts`, `landing-fx.tsx` |
| LEG-02 | Horario confirmado: lunes a viernes9–17Argentina, visible en Contacto/Ayuda. Denominación de baja y prioridad de recepción para arrepentimiento/baja pública | BRAND, Contacto, Ayuda, PublicShell, contactAction/contact.ts |
| Logs | Errores por consola reducidos a contexto/tipo/código conocidos; no se imprime el objeto con mensaje, stack, credenciales o cuerpo | `diagnostics.ts`; `diagnostics.test.ts` |

## Validación ejecutada y límites

Suite completa ejecutada: **443 pruebas aprobadas,2 omitidas,62 archivos (61 aprobados,1 omitido),163,74s**. Las2omitidas requieren PostgreSQL real local aislado y están previstas en CI, con guardas de host/nombre/base sin usuarios. No se suman las repeticiones de subconjuntos para inflar el total.

Después se reforzó además la defensa de retención a nivel de FKs (RESTRICT) y la cuarentena de correos para compatibilidad con versiones antiguas. Las17regresiones dirigidas de migración, ledger, métricas, correo y backup pasaron tras ese refuerzo. TypeScript y la compilación final de producción local pasaron con base sintética aislada y pagos/correo externos deshabilitados. Se verificó que el artefacto del servidor incluye los159archivos de unpdf y sus metadatos necesarios. `npm audit --json` informó0avisos conocidos. No son Mercado Pago sandbox ni certificación de seguridad.

Se ejecutó smoke HTTP sobre una compilación local: páginas públicas, redirects de app/admin sin sesión, no-store y rechazo de cron/operaciones sin autorización. No se presenta como un recorrido visual.

El navegador volvió a estar disponible, pero la revisión automática rechazó el inicio de la vista local tanto con credenciales ficticias como con pagos deshabilitados, indicando solamente “blocked by policy”. No se intentó eludir el bloqueo. Por eso no hubo inspección visual final de los cambios, ni pruebas de mobile/teclado/lector realizadas en esta versión. Los tests de PostgreSQL multiconexión quedan preparados para el servicio aislado de CI: no había PostgreSQL nativo/Docker local disponible y se omiten explícitamente cuando no existe TEST_DATABASE_URL. El ensayo de restauración sí se ejecutó con PostgreSQL PGlite local y datos sintéticos.

No se certifica el ciclo externo de MP, entrega real de Resend, rendimiento CWV, carga de10000/100000usuarios, backups/PITR del proveedor ni visibilidad legal en dispositivos reales. La conciliación sigue siendo un trabajo acotado: cursor y alertas evitan trabajo infinito, pero no equivalen a una prueba de capacidad ilimitada. La operación externa y PostgreSQL no forman una transacción ACID; las intenciones y compensaciones permiten recuperarse, y las discrepancias necesitan seguimiento.

La facturación fiscal se dejó fuera por instrucción posterior del titular. La recepción bidireccional de soporte por email continúa aplazada; los hilos/formularios web sí existen. No se activaron campañas ni correos de marketing.

## Aplicación y reversión

Ver [despliegue.md](despliegue.md). Hay una migración aditiva; no cambia precios, monedas, trials, comisiones ni contratos vigentes por sí sola. La publicación y las configuraciones externas requieren autorización posterior. Nunca usar un cobro real como smoke test.
