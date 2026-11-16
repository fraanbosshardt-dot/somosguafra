# Plan de corrección, aceptación y operación

Propuesta posterior al diagnóstico; no ejecutada. Requiere aprobación para implementar y autorización explícita adicional antes de desplegar a producción. Cada tanda irá en rama separada con diff, regresiones, preview y riesgos residuales. No se cambian el modelo comercial ni contratos existentes por iniciativa de la auditoría.

## D. Prioridades

| Prioridad | Qué cambia / por qué | Dependencias y riesgos | Criterio de éxito |
|---|---|---|---|
| P0: retención de ledger al borrar pagador | Desacoplar eventos empresariales de Workspace; evitar pérdida irreversible FIN-01 | Decisión legal de retención/minimización; migración compatible y prueba de borrado. Riesgo: retener PII excesiva o romper enlaces de conciliación | Borrado ficticio conserva totales históricos, acceso y cobros quedan detenidos, información personal se elimina según política |
| P1: métricas y estados | Contrato activo separado de intento; etiquetas completas; aggregates independientes de muestra | Unificar consulta sin cambiar contratos ni facturas; precisar MRRdecompromiso vs cobertura | MRR7499 no cambia por intentoanual;201+totales; pending≠rechazado |
| P1: bajas y avisos | Confirmación segura admin, evento canónico de baja, estado verificando cuando proveedor falla | Dedupe debe permitir transiciones genuinas futuras; no cancelar por GET ni cerrar pestaña | Una baja produce un aviso; click sin confirmar no llega a API |
| P1: identidad | Validación central de entorno, step-up2FA y reservas de rate limit; alta atómica/recuperable | Mantener sesiones y migración gradual; evitar bloqueos masivos por configuración | Configuración faltante falla cerrado; cuotas respetadas bajo concurrencia; registro con fallo recupera |
| P1: recuperación/alertas | Cursor y presupuesto interno, discrepancias durables, detector sin límite silencioso, alarmas externas | Contrato API y límites de proveedor; no reprocesar cobros como nuevas órdenes | Corte a mitad reanuda;1001incidencia detectada; alerta sintética llega al responsable |
| P1: respaldo y fiscal/consumidor | Confirmar backups/PITR, restauración aislada y flujo de comprobante/solicitud de baja | Acceso a proveedores y asesoría; ningún dump sensible dentro del informe | Restore íntegro conRPO/RTO registrado; responsable de trámites y plazos |
| P2: facturación/soporte/UX | Historial paginado, modal accesible, copy fiel, salto de contenido, política exportación | Validación de UX real; enlaces externos aprobados | Caso21/pago25 visibles, teclado confinado, facturación solo a roles previstos |
| P2: rendimiento/calidad | Agregados/cohortes, queries compartidas por request, cuotasPDF, preview/build/E2E | Baseline y datos sintéticos; evitar caché entre tenants | Menos queries/memoria con mismos saldos; datos nunca cruzan espacios |
| P3: evolución | Motivos de baja, analítica de activación, eliminación de residuos, escala ensayada | Base legal/minimización; datos maduros para fórmulas | Métricas reproducibles; ninguna campaña marketing ni cancelación dificultada |

La tabla central de README es la prioridad de implementación propuesta. Los informes especializados conservan sus valoraciones locales: PAG-01 es elevado a bloqueoP0 **para borrar clientes pagadores**, y el aviso duplicadoPAG-03 se agrupa enP1 de confianza junto a bajas. No implica que se haya observado pérdida en producción.

## E. Roadmap y esfuerzo

Esfuerzo estimado para una persona senior, con revisión QA/seguridad y soporte contable/legal cuando corresponda. Tareas se solapan; no sumar todas las cifras como fecha de entrega garantizada.

| Ventana | Entregable | Esfuerzo | Dependencias / puerta de salida |
|---|---|---|---|
| Primeras24h | Aprobar alcance; convertir3reproducciones en regresiones; diseño de ledger; fixtures de estados/cobros; correcciones pequeñas de MRR/etiquetas/dedupe/confirmación en rama |1–2d de ingeniería; no prometer resolver migración en24h | Aprobación; no borrar pagadores mientras se define retención; revisión de diff |
| Primera semana | Ledger compatible y pruebas de borrado; entorno/2FA/registro; alerta externa y restore; tests de corteAPI/DB/multiconexión |4–7d + asesoría/proveedor | Staging seguro y revisión de migración; sandbox oficial disponible para aceptación externa |
| Primer mes | Reconciliación incremental/saga durable, paginaciones, CIpreview/E2E, mediciónrendimiento, fiscaltrazable, revisiónlegal, PDFcuota, exportaciones |10–20d según integración | Contratos de API y accesos; baseline; definirSLO y dueño de incidentes |
| Próximos90d | Ensayo carga1000/10k; simulacroDR; embudos/cohortes maduros; presupuesto por cliente; crecimiento por capacidad medida |2–4semanas distribuidas | Tráfico/datasetrepresentativo, tarifasreales y límitesproveedores; no reclamar100k listos sin ensayo |

No propongo microservicios ni un rediseño por estética. Primero mantener el monolito y separar responsabilidades donde existe un fallo concreto: selección contractual, transición de baja, entorno, límites, ledger y cursor de reconciliación.

## Estrategia de pruebas

1. **Unitarias:** calendario31/01 y bisiesto, frontera exacta de trial, etiquetas de estados, precios/descuentos, estados de acceso y MRR. Congelar reloj; probar zona del espacio y offsetproveedor.
2. **Integración PostgreSQL:** conservar PGlite para velocidad y sumar PostgreSQL real con≥2conexiones/procesos. Doblecheckout, cancelación↔webhook, uso simultáneo de cupón, bloqueo/cuota, invoice↔paymentID y borrado de pagador. No usar pool1 como única evidencia de carrera resuelta.
3. **Contratos API:** fixtures oficiales MP de pending/authorized/paused/cancelled, paymentapproved/refunded/charged_back; IDs incoherentes, firma inválida/vencida, versión anterior,429/500/timeout, páginas con/sinpaging y respuesta parcial. Resend: aceptaciónremota+falloDB y ventana de idempotencia.
4. **Fallos controlados:** cortar después dePOSTcreación/PUTcancelación antes delcommit; reintentar con proceso nuevo. Exigir convergencia sin segundo contrato, período duplicado ni acceso gratis. Persistir intención/compensación si no se puede garantizar.
5. **E2E staging:** matriz28casos de pagos.md; cuentas ficticias free/trial/paid/rejected/canceled/admin; sandbox oficial para casos disponibles y marcar los no reproducibles. Nunca simular proveedor con credenciales de producción.
6. **Seguridad:** acción por acción contra noauth/2FAincompleto/suspendido/VIEWER/EDITOR/dueño/miembrorevocado y relaciones de otro espacio. CSRF de transporte, resetcarrera, rolesadmin, enlaces de consulta y campos exportados. Ensayos locales sin atacar terceros.
7. **UX/accesibilidad:**320/360/390/430px, landscape, texto200%, tecladoabierto, safeareas; tecladoTab/ShiftTab/Escape, foco inicial y retorno, lector, contraste, errores y estadosvacíos. Verificar plan/free/trial/pagopendiente sin superposición ni texto cortado.
8. **Regresión funcional:** saldos/reversas/transferencias, pagosparciales, tarjetas/deudas, CSV/OFX/XLSX/PDF, recurrencias, escenarios, granos, inversiones y roles. Datos ficticios representativos; comparar cifras y conservación, no solo screenshots.
9. **Rendimiento/operación:** baseline en verificaciones.md; carga escalonada con tasaerror/latencia/pool/memoria/backlog, restore y rollback ensayados. Sin carga contra producción en esta auditoría.

### Puertas de aceptación de dinero

- Precio/ciclo/moneda provienen del servidor y coinciden con acuerdo y pago; catálogo cambiado no cobra de más silenciosamente.
- Una autorización no concede cobertura paga; rechazo/pendiente no extienden período.
- Repetir webhook diez veces y cambiar orden no duplica ingreso/período/correo de un mismo evento.
- Cliente cierra navegador tras pago: webhook/conciliación activan igual, con SLO medido.
- Baja falla remotamente: no informa cancelada; conserva intención, alerta y vínculo para reintentar.
- Refundtotal/contracargo revocan solo cobertura correspondiente; parcial registra importe y mantiene política.
- Mensual→anual mantiene cobertura y evita dos renovaciones, incluso tras reinicio en pasos externos.
- Eliminar usuario conserva ledger mínimo y no permite futuros débitos; antes se confirman todos los contratos conocidos.

## Monitoreo propuesto

| Señal | Umbral inicial propuesto, ajustar con tráfico | Respuesta |
|---|---|---|
| Disponibilidad/500 | Sondeo5min;2fallos consecutivos o500>1%convolumenmínimo | Alerta responsable, revisar despliegue/DB |
| Checkout | Excepciones/tasaerrores por operación y correlación, sin cuerpo sensible | Investigar; no crear nuevo contrato a ciegas |
| Webhooks |500consecutivos, firma inválida anómala y antigüedadprocesado | Alerta y reconciliaciónpriorizada; no aceptar sin firma |
| Cron/conciliación | Sin éxito>45min; edadp95/máxima por estado superaSLO | Cola/backlog, proveedor y ejecución; distinguir loteparcial |
| Creating/uncertain | Advertir>5min; escalar>30min | Revisar por API y referencia, no duplicarPOST |
| Dos autorizados/espacio | Cualquier ocurrencia | Incidente; consulta y resolución humana, no cancelaciónindiscriminada |
| Pago con acceso incorrecto | Cualquier discrepancia verificada | Alerta y reparaciónidempotente, conservar evidencia |
| Rechazos | Desvío de baseline por ventana con tamaño mínimo | Proveedor/medio/precio; no marcar trial como churn |
| Correo crítico | Oldest>15min aviso,>60min crítico; proveedorrechaza | Reintentar/outbox; no revertir estado de pago |
| Login/reset | Picos porIP/cuenta y lockouts | Limitaratómicamente, proteger acceso legítimo |
| Soporte/bajas | Plazo especial y SLA por tipo, no soloedadgeneral | Asignación/escalamiento responsable |
| Backups | Copia fallida,edad>RPO o restoreensayado vencido | Escalar y ensayarrecuperaciónaislada |

No se activó ni envió ninguna notificación externa. Hay que elegir canal/destinatario autorizado y probarlo. Logger estructurado debe redactar Authorization,cookies,tokens,DSN y datos personales; usar identificadores internos/correlación sin importes de finanzas personales. Auditoría no debe depender únicamente de console.error ni del usuario abriendo el panel.

## Checklist de despliegue controlado

- [ ] Aprobación del alcance, rama separada, revisión de diff y regresiones nuevas.
- [ ] Migración expand/contract compatible; script de preservación no destructivo ensayado con copia ficticia.
- [ ] Types/tests/build/contratos/preview pasan; verificación visual y transporte por roles.
- [ ] Ningún secreto ni dato personal en fixtures/logs/reportes. Entorno de sandbox falla cerrado ante credencial real.
- [ ] Backup/PITR y restore confirmados, RPO/RTO y dueño definidos.
- [ ] Contratos vigentes y contadores antes/después conciliados, cambios de precio/ciclo no implícitos.
- [ ] Métricas y alertas de acceso/pagos/outbox/backlog observables.
- [ ] Autorización explícita para producción, ventana/responsable y criterios de rollback.
- [ ] Tras despliegue: GETs/sesión/roles/lecturas y reconciliación controlada; ningún cobro real como smoke test.

## Checklist de rollback

- [ ] Registrar despliegue anterior, versión de esquema y compatibilidad antes de promover.
- [ ] Volver al despliegue previo si errores/discordancias superan umbral, conservando datos y eventos nuevos.
- [ ] No ejecutar downmigration destructiva ni restaurar toda la DB sobre pagos posteriores a la copia.
- [ ] Si hay cambios externos iniciados, consultar MP y completar/compensar por intención durable; rollback de código no deshace unPUT.
- [ ] Pausar nuevas operaciones afectadas solo mediante mecanismo previamente probado/aprobado; no cancelar todas las suscripciones.
- [ ] Conciliar importes/períodos/contratos y outbox; demostrar estadofinal antes de reabrir.
- [ ] Comunicar impacto y seguimiento por canal autorizado, con revisión del incidente.

## Pendientes explícitos

La recepción bidireccional de soporte por correo sigue aplazada por decisión previa del titular. El formulario/hilo web existe; no prometer respuestas a un buzón todavía no configurado. Necesitará DNS/APIkey/webhookSvix y verificación externa, fuera del alcance de cambios autorizados aquí.

No se configura sandbox ni se ejecutan transacciones automáticamente. Las pruebas oficiales requerirán acceso seguro a una integración de prueba; nunca pedir claves o tarjetas en el informe ni usar cobros reales para resolver la carencia de entorno.
