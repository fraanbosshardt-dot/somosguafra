# Aplicación, operación y reversión

Preparado, no ejecutado en producción. Rama `fix/auditoria-integral-20261115`.

## Antes de promover

1. Revisar diff, resultados y aceptación pendiente. Confirmar Node22o superior: la dependencia PDF instalada lo requiere y engines/lockfile ya lo declaran.
2. Configurar staging con DB aislada; nunca apuntar una preview al PostgreSQL productivo por comodidad. El comando existente `vercel-build` aplica migraciones antes del build: revisar las variables de cada entorno antes de publicar una rama.
3. Ensayar `20261116010000_audit_reliability` en copia ficticia/anonimizada. La migración agrega Workspace.archivedAt; cursor/fecha/intención de BillingAgreement; y estado/lease/intento de EmailOutbox. Conserva IDs y cambia tres FKs de borrado en cascada a RESTRICT para impedir pérdidas de ledger incluso desde código antiguo. Estos ALTER necesitan locks de tabla: programar ventana y medir duración sobre copia representativa. Backfill de correos omitidos no los presenta como entregados; correos retenidos tienen fecha de reintento fuera de plazo para que una versión anterior tampoco los reenvíe durante el rollout.
4. Confirmar AUTH_SECRET existente, APP_URL y remitentes mediante mecanismos seguros, sin imprimir valores. No rotar AUTH_SECRET al desplegar: cifrado TOTP y firmas existentes dependen de él.
5. Confirmar backup/PITR nativo del proveedor y custodia/retención. Para el script de copia manual se requiere BACKUP_ENCRYPTION_KEY independiente,32bytesbase64; guardarla fuera de las copias. No publicar la clave en el repositorio, informes, terminal compartida ni chat.
6. Completar revisión visual local/staging y PostgreSQL real multiconexión. Probar el worker PDF dentro del empaquetado de preview con un PDF sintético; no usar documentos de clientes.
7. Si se desea aceptación oficial de pagos, preparar integración sandbox por fuera del informe. Hasta entonces las pruebas son simuladas y ninguna autorización actual habilita cobros reales.
8. Configurar CRON_SECRET en GitHub mediante el almacén de secretos, tras autorización, para activar el chequeo de `/api/health/operaciones`. Si falta, el workflow avisa que solo controla disponibilidad pública. Verificar canal/destinatario de alertas y ejecución de cron; una definición YAML no garantiza operación real.
9. Obtener autorización explícita de producción; registrar versión, responsable, ventana y umbrales de reversión.

## Verificaciones después de aplicar

- Páginas públicas/ingreso/health y acceso por rol, sin ejecutar un checkout de dinero real.
- MRR del contrato vigente no cambia al existir intento anual pendiente ficticio; pendientes no se cuentan como churn ni como ingreso.
- Última conciliación, cursor y cola no presentan discrepancias; detectar cancelaciones en verificación, varios contratos autorizados o pago cubierto sin acceso.
- Revisar outbox uncertain/suppressed/queued/sent. No reenviar automáticamente un uncertain: comprobar aceptación con el proveedor y decidir de forma trazable. Verificar remitente/destinatario y que la notificación siga correspondiendo.
- Registros archivados no tienen usuarios, miembros, acceso ni finanzas personales. Siguen admitiendo eventos financieros tardíos y conservan exclusión original de cuentas internas.
- Borrado de cuentas pagadoras solo después de confirmar todos los acuerdos conocidos; una cancelación externa fallida conserva la cuenta y los vínculos para reintentar.

## Ensayo de restauración

Crear una base local aislada vacía y aplicar las migraciones del mismo snapshot. Usar `RESTORE_DATABASE_URL` local y `BACKUP_ENCRYPTION_KEY` en el entorno seguro del proceso. Ejecutar `npx tsx scripts/restore-backup.mts --empty-local <copia.enc.json>`. El script rechaza destinos remotos y datos preexistentes, excepto el ajuste inicial de analítica creado por migración. No trunca ni sobrescribe tablas. Clave equivocada o contenido alterado falla antes de restaurar. La comprobación se hace en una transacción con validación final de relaciones y cantidades.

El respaldo JSON cifrado tiene un límite de256MB descomprimidos; para volúmenes mayores utilizar backups nativos/PITR y un procedimiento de streaming revisado. La prueba local ejecutada no acredita acceso externo, cifrado del disco del proveedor, retención real ni RPO/RTO productivos.

## Rollback

- Volver al despliegue previo conserva las columnas agregadas; no ejecutar una downmigration destructiva ni restaurar toda la DB sobre pagos más recientes que la copia.
- Antes de volver a una versión antigua, revisar intenciones de cancelación y correos uncertain. La versión antigua no conoce los nuevos estados y puede reintentar correos fuera de su ventana o ignorar una intención. No hacer un rollback ciego: resolver/aislar la cola y detener temporalmente el trabajo afectado mediante un procedimiento aprobado; preferir un hotfix compatible.
- Nunca revertir un PUT de Mercado Pago creando automáticamente un contrato nuevo. Consultar el estado actual y completar/compensar por intención durable. Código y proveedor no retroceden juntos.
- Los registros financieros archivados no se borran durante la reversión. No reasignar miembros ni restablecer cuentas por inferir un pago.
- Comprobar pagos/períodos/contratos/outbox, registrar el incidente y reabrir operación solo después de converger.
