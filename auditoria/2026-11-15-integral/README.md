# Auditoría integral de somosguafra

Fecha: 15 de noviembre de 2026. Código auditado: `d05880ea36d8d0a6dbb951e7913969f5d07dee3a` (`main`). Diagnóstico sin modificaciones del producto, configuraciones externas, datos reales ni transacciones de pago. Solo se agregaron documentos de auditoría en esta carpeta. No se hizo commit, push ni despliegue.

## A. Resumen ejecutivo

La base del producto es razonable: monolito modular, controles de acceso en servidor, importes de contratación calculados en servidor, separación entre autorización de débito y cobertura paga, idempotencia persistida, transacciones con bloqueo por espacio y recuperación programada. Las pruebas financieras no se limitan al caso feliz. No confirmé que regresar del checkout otorgue Pro indebidamente ni que un pago rechazado amplíe cobertura.

Sin embargo, no considero acreditada la preparación integral para crecer ni la operación financiera sin supervisión. Hay pérdida de historial empresarial al eliminar un espacio, métricas que cambian incorrectamente ante solicitudes pendientes, avisos duplicables de baja, controles de autenticación con límites incompletos y recuperación/monitoreo con capacidad limitada. No se ha comprobado en esta auditoría el ciclo oficial de Mercado Pago con cuentas de prueba, la restauración de backups ni el uso visual completo de la app.

### Arquitectura y reglas actuales

- Next.js 16.4.6 / React 19.3.1 / TypeScript 5.9.3, Node >=20.19; CI Node22. Prisma 7.10.1, PostgreSQL, adapter pg; PGlite aislado en tests. Backend en Server Components, Server Actions y Route Handlers. Inventario completo en [inventarios.md](inventarios.md).
- Alojamiento previsto Vercel `sfo1`, PostgreSQL Railway; no se inspeccionaron límites, facturas ni configuración de esos proveedores. Resend para correo transaccional; Google OAuth; fuentes de cotizaciones públicas y Web Push.
- Gratis permanente (5 cuentas/3 objetivos). Pro mensual/anual ARS; catálogo configurable en servidor. Trial explícito de 14×24h sin tarjeta, una vez por espacio. La restricción por espacio no garantiza una prueba por persona física.
- `Subscription` describe acceso; `BillingAgreement` conserva contratos/intentos; `Invoice` registra cada cobro/período; `PaymentEvent` sus efectos financieros; `EmailOutbox` comunica eventos. No equivalen entre sí.
- Checkout: selección → registro/login/verificación → resumen privado → POST explícito → autorización MP → webhook/API → cobertura de pago → vuelta a `/app`. El retorno ayuda a conciliar y no es prueba de cobro.
- Renovación: MP cobra; webhook firmado consulta recursos oficiales y actualiza bajo bloqueo. Respaldo configurado cada15min y diario. Ese schedule está en código; no se confirmó su ejecución en la cuenta Vercel durante esta revisión.
- Cancelar: intenta detener acuerdos externos y mantener cobertura ya pagada. No implica devolución ni eliminación de cuenta. Una baja externa no confirmada no se presenta como exitosa.

### Resultados ejecutados

| Verificación | Resultado observado | Alcance |
|---|---|---|
| `npm run typecheck` | Exit0 | Tipado del snapshot |
| `npm test` | 383/383, 51/51 archivos, 143,75s | Unitarias e integración local; APIs de pagos simuladas |
| `npm audit --json` | Exit0, 0 avisos conocidos, 379 dependencias reportadas | Registro npm; no certifica el código ni vulnerabilidades inéditas |
| Migraciones | 25/25 aplicadas en base local vacía | `127.0.0.1:5437`, datos ficticios; sin drift de producción |
| `npm run build` | Exit0, compilación y58 páginas estáticas generadas | DB PGlite local; no migraciones remotas |
| Regresión exploratoria: MRR | Contrato mensual vigente7499 → agregar anual pendiente → MRR0; pagador sigue1 | Reproducción local; defecto confirmado |
| Regresión exploratoria: borrado | Workspace ficticio con Invoice/PaymentEvent → borrar → ambos desaparecen | PGlite local; defecto confirmado |
| HTTP público pasivo |28/28 páginas del inventario público devolvieron200, title y unh1; robots/sitemap/health200; `/app` anónimo307; www308 con TLS válido | GET sin sesión, sin seguir checkout ni mutaciones; detalle en http-publico.md |
| Navegador | No disponible: inventario devuelve browsers vacío y error de acceso | No recorrido visual ni pruebas móviles actuales |

Los subconjuntos de seguridad y pagos detallados en otros documentos se solapan con los383 tests; no deben sumarse para inflar cobertura. Las reproducciones exploratorias se documentan aparte.

### Puntuaciones solicitadas

Una nota de preparación real de0–100 exigiría cuatro evidencias por categoría: implementación25, regresiones25, validación runtime representativa25 y controles operativos25. Si falta evidencia material no asigno una nota parcial como si fuera final.

| Área | Nota | Evidencia disponible y motivo |
|---|---|---|
| Pagos | No evaluado integralmente | Código y simulaciones sólidos; falta contrato/E2E oficial y panel proveedor |
| Suscripciones | No evaluado integralmente | Máquina reconstruida; faltan renovaciones reales de sandbox y fallos de infraestructura |
| Trial | No evaluado integralmente | Reglas y pruebas locales; falta recorrido visual y abuso multicuentas representativo |
| Cancelaciones | No evaluado integralmente | Pruebas locales; duplicación de avisos y falta verificación oficial |
| Seguridad | No evaluado integralmente | Controles y pruebas negativas; sin pentest de transporte/infra ni configuración externa |
| Rendimiento | No evaluado | Muestras HTTP y tamaño JS; sin CWV/RUM/carga ni consultas medidas |
| Calidad de código | No evaluado integralmente | Tipos/tests/build pasan; sin cobertura instrumentada, lint ni contratos completos |
| UX/UI | No evaluado | Inspección de componentes/CSS, sin navegador actual ni usuarios de prueba |
| Landing | No evaluado integralmente | Copy/SEO/cabeceras y GET comprobados; comprensión10s/conversión no medidas |
| Confiabilidad | No evaluado | Falta restauración, incidentes sintéticos y confirmación de alertas externas |
| Escalabilidad | No evaluado | Cuellos de botella estáticos identificados; ninguna prueba de carga |
| Preparación para producción | No evaluado | No equivale a que hoy esté caída; faltan las aceptaciones anteriores |

No invento una nota global favorable a partir de un build exitoso. La decisión aconsejada es corregir primero riesgos de dinero/datos y completar evidencias pendientes antes de aumentar adquisición.

## B. Hallazgos priorizados

`Confirmado` significa conducta visible en código o reproducción indicada; `riesgo` requiere las condiciones descritas. P0 significa bloqueo para la operación afectada, no afirmación de pérdida real ocurrida. Estimaciones son esfuerzo de ingeniería, no promesas de calendario.

| ID / categoría | Severidad / tipo / prioridad | Problema y evidencia | Impacto | Solución, complejidad / esfuerzo | Validación |
|---|---|---|---|---|---|
| FIN-01 / retención | Alta, confirmado; P0 antes de borrar pagadores | `admin-accounts.ts:86`, `schema.prisma:828,1014`: cascada borra Invoice/PaymentEvent; reproducción local | Desaparece historial de cobros/cohortes; conciliación y soporte pierden trazabilidad | Ledger empresarial independiente del workspace, anonimización y retención definida; alta,2–4d + asesoría | Borrar cliente ficticio conserva importes/IDs de proveedor; datos personales eliminados según política |
| FIN-02 / MRR | Media, confirmado; P1 | `admin-metrics.ts:43-53`: último acuerdo pendiente anual oculta mensual vigente; reproducción7499→0 | Decisiones comerciales basadas en MRR falso; no altera por sí mismo un cobro | Seleccionar contrato vigente por providerRef y separar intento; media,0,5–1d | Fixture mensualactivo+anualpendiente conserva MRR7499 y cuenta intento separado |
| PAY-EMAIL / bajas | Media, confirmado por claves; P1 | `billing.ts:212,277`: baja manual y webhook usan distintas claves outbox | Doble aviso, desconfianza y tickets | Identidad de evento única por transición/contrato; media,0,5–1d | Baja→webhook→conciliación→repeticiones produce un solo aviso |
| PROD-01 / admin | Media, confirmado; P1 | `admin/(panel)/cobros/page.tsx:47,61`: estados restantes etiquetados cancelada/rechazado | Interpretación errónea de trial, pendiente y contracargo | Etiquetas exhaustivas y fallbackneutral; baja,0,5–1d | Cada estado conserva su significado |
| PROD-02 / métricas | Media, confirmado; P1 | `cobros/page.tsx:23,28,37`: totales derivados de200filas | Subconteo silencioso al crecer | Counts independientes y paginación; baja,0,5–1d |201+suscripciones, totales exactos |
| SEC-01 / 2FA | Media, confirmado; P1 | `actions/app.ts:374-397`: quitar/confirmar TOTP sin limitación fallos | Sesión completa robada puede probar códigos sin cupo específico | Reautenticación reciente y cupo atómico; media,0,5–1d | Sexto fallo bloqueado,20intentos concurrentes respetan cupo |
| SEC-02 / entorno | Alta condicionada, riesgo; P1 | `server/email-verify.ts:17`, `account-mail.ts:10`: fallback secreto vacío | Códigos/enlaces predecibles si falta AUTH_SECRET; producción no comprobada | Entorno central validado, fallo cerrado; baja,0,5d | Sin secreto no se emite ni verifica |
| SEC-03 / backups | Media operativa, confirmado; P1 | `scripts/backup-db.mts:14,22`: SELECT*→JSON local sin cifrado | Material sensible expuesto si se pierde copia/equipo; no filtración demostrada | Cifrado, custodia, ACL, retención y restore; media,1–3d | Restauración ficticia íntegra y acceso restringido |
| SEC-04 / registro | Media, confirmado; P1 | `actions/auth.ts:39-40`, `server/google-auth.ts`: User y Workspace no atómicos | Cuenta huérfana ante fallo, registro no recuperable por camino normal | Unidad transaccional o reparación idempotente; media,1d | Fallo inyectado no deja alta sin salida |
| SEC-05 / abuso | Media, confirmado; P1 | `actions/auth.ts:56-69,114-122`: count→write | Ráfagas exceden límites; consumo correo/DB | Reservar cuotas por usuario/IP con expiración; media,1–2d | Concurrencia y reset distribuido ficticios |
| OPS-01 / recuperación | Alta potencial; P1 | `billing-maintenance.ts:12`, `billing.ts:357-404`:40activos/lote, histórico completo por acuerdo | Cola atrasada y timeout; pérdida temporal de acceso o reversas tardías | Cursor, priorización/SLO, presupuesto interno y reintentos; alta,2–4d | Backlog con historial largo termina, sin duplicar cobertura |
| OPS-02 / detector | Media, confirmado; P1 | `operations.ts:11`: máximo1000facturas | Alertas omiten pagos sin acceso fuera de muestra | Agregado/barrido paginado; baja,0,5–1d | Incidencia1001detectada |
| OPS-04 / alertas | Alta potencial; P1 | `operations.ts`, `.github/workflows/salud.yml`: panel y chequeo horario | Incidente monetario puede permanecer sin aviso externo | Alertas por SLO con responsable y canal autorizado; media,1–3d | Falla sintética avisa y recuperación cierra incidente |
| LEG-01 / fiscal | Alta condicionada, incompleto; P1 | Sin emisor fiscal en rutas/modelos; `Invoice` registra pago, no CAE fiscal | Recibo de MP no acredita que GUAFRA cumpla emisión fiscal | Confirmar régimen y proceso manual/fiscal con contador; esfuerzo según integración | Pago ficticio vinculado a comprobante fiscal o tarea trazable, sin emitir comprobantes reales de prueba |
| LEG-02 / consumidor | Media, revisión profesional; P1 | `public-shell.tsx:70-73`, `contacto/page.tsx:44-50`, `legal.ts`: enlaces al pie y SLA genérico, sin horario publicado | No se acredita cumplimiento de visibilidad/denominación, horarios y ejecución de baja pública | Revisar frente a norma actual; canal claro, horario y SLA separado;0,5–1d + revisión | Solicitud sin sesión genera código y llega a responsable dentro del plazo aplicable |
| SEC-06 / exportación | Baja, confirmado; P2 | `admin-accounts.ts:51-53`: SupportMessage omitido | Exportación de datos incompleta | Incluir mensajes públicos propios, excluir notas; baja,0,5d | Fixture público/nota privada |
| SEC-07 / permisos | Media, decisión pendiente; P2 | `admin-accounts.ts:26-48`: membresía recibe exportación con facturación | Datos de facturación compartidos más ampliamente de lo esperado | Definir alcance invitado; factura solo dueño; media,0,5–1d | Matriz OWNER/EDITOR/VIEWER |
| SEC-08 / OAuth | Baja, endurecimiento; P2 | `lib/auth/google.ts:38-61`: claims del token HTTPS sin JWS local | Dependencia de supuestos del intercambio; no bypass demostrado | Verificación JWKS mantenida; media,1d | Firma/issuer/aud/nonce/exp negativos |
| SEC-09 / PDF | Media potencial; P2 | `actions/modules.ts:774-817`, `statement-pdf.ts:137-180`: cuota check→parse→log | Concurrencia y CPU/memoria no presupuestadas | Reserva cuota, timeout/aislamiento y cleanup; media,1–2d | Límite concurrente y documento complejo seguro |
| PERF-01 / admin | Media potencial; P2 | `admin-metrics.ts:36,99-104`: historial completo y búsqueda U×A | Latencia/memoria crecen con histórico | Agregados DB/índices medidos; media,2–4d | Baseline y EXPLAIN a volumen representativo |
| PERF-02 / Inicio | Media potencial; P2 | `app/app/page.tsx:34-37`, `ledger.ts:586-630` | Lectura duplicada de pendientes | Reutilizar por request/selects; media,1–2d | Mismas cifras con menos queries |
| PERF-03 / FX | Baja potencial; P2 | `company-finance.ts:26,33`, `admin-metrics.ts:9-23` | N+1 al convertir moneda noARS | Mapa de tasas por request; baja,0,5–1d | Número de queries independiente de eventos |
| UX-01 / modal | Media, confirmado; P2 | `confirm-submit.tsx:18-38`: sin trap/inert, autofocus destructivo | Teclado sale al fondo; Enter accidental | Foco inicial seguro/modal nativo probado; media,0,5–1d | Tab/ShiftTab/Escape/lector |
| UX-03 / cancelación admin | Media, confirmado; P1 | `cobros/page.tsx:50`: submit directo | Un clic puede detener renovación equivocada | Confirmar cuenta/efecto/cobertura; baja,0,5d | Sin confirmación no se invoca proveedor simulado |
| UX-04 / soporte | Baja, confirmado; P2 | `app/app/ayuda/page.tsx:53`:20casos sin paginar | Historial antiguo inaccesible desde listado | Cursor/enlace por caso; baja,0,5–1d |21casos navegables sin fuga |
| UX-02,05 / textos | Baja, confirmado; P2 | `app/layout.tsx:73,99`, `ayuda/page.tsx:33` | Avisos repetidos y FAQ no describe resumen intermedio | Consolidar y actualizar copy; baja,0,5d | Móvil y recorrido de contratación |
| MAINT-01 / CI | Media, carencia; P2 | `package.json`, `.github/workflows/ci.yml` | Sin lint/build gate/E2E completo antes de producción | Gate preview y regresiones por riesgo; media,1–3d | PR rota no promueve despliegue |
| MAINT-02 / residuos | Baja, confirmado; P3 | `lib/modules.ts:58`, `landing-fx.tsx:47` | Precio/toggle antiguos reutilizables por error | Deprecar tras comprobar consumidores; baja,0,5d | Catálogo único; ningún cambio de plan implícito |
| PAG-05 / autoservicio | Media, incompleto; P2 | `configuracion/page.tsx:180`, `subscription-summary.tsx`: últimas24facturas, sin paginación ni gestión contextual de medio de pago | Historial y recuperación de pagos poco claros | Paginar e integrar enlaces/guías oficiales validados; media,2–5d | Pago25 visible y recorrido de cambio de medio en sandbox |
| PAG-06 / pasos externos | Alta potencial; P1 | `billing.ts:78-94,209,253-262`: PUT externo dentro de transacción local | Rollback DB no deshace cancelación remota; compensación puede fallar | Intención y pasos durables con reconciliación; alta,3–5d | Corte después dePUT y antes decommit converge tras reinicio |
| PAG-07 / entrega correo | Baja potencial; P2 | `billing-mail.ts:26`, `lib/email.ts`: lease y dedupe externo temporal | Reintento largo tras aceptación no registrada podría duplicar correo | Política de entrega incierta y destinatario vigente; media,1d | FalloDB tras envío simulado y reintento fuera de ventana |
| UX-06 / navegación accesible | Baja, mejora; P2 | `public-shell.tsx:26`, `public-nav.tsx:39-50`: main conID, sin enlace de salto | Más pasos de teclado para llegar al contenido | Enlace visible al foco; baja,0,25d | PrimeraTab permite saltar y foco llega a main |

Las tablas especializadas amplían estos hallazgos; sus IDs pueden señalar el mismo problema. No se cuentan duplicados como vulnerabilidades distintas. No se encontró un bypass P0 de seguridad confirmado ni se demostró un cobro duplicado real.

## C. Riesgos económicos

1. **Pérdida contable confirmada por reproducción:** borrar cliente borra eventos. Debe resolverse antes de eliminar cuentas que hayan pagado.
2. **Cobro duplicado potencial ante fallas externas:** reservas/bloqueos y recuperación mitigan doble clic; la sustitución de acuerdos implica operaciones remotas fuera de una transacción distribuida. Si cancelar el anterior y compensar el nuevo fallan, necesita alerta y conciliación humana. No existe garantía absoluta de atomicidad entre PostgreSQL y MP.
3. **Cobro omitido:** cambio de contrato con resultado incierto puede detener uno sin completar el otro; no recrear a ciegas. Investigar estados creating/uncertain y diferencias con proveedor.
4. **Acceso gratuito indebido:** autorización sola está correctamente separada del pago. Persisten riesgos condicionales de entorno/verificación y de concesiones manuales humanas; no se demostró activación por importe manipulado.
5. **Pago sin acceso:** webhook perdido más backlog o caída DB puede retrasar activación. El retorno no cubre al usuario que cierra navegador; la conciliación sí es necesaria y debe tener SLO verificable.
6. **Cancelación no procesada:** dependencia de API; debe conservarse solicitud y escalar hasta confirmar, sin afirmar baja por un HTTP200 no corroborado. El submit admin sin confirmación aumenta bajas accidentales.
7. **Reembolso/contracargo tardío:** dos acuerdos históricos por lote y lectura repetida del historial pueden demorar ajustes. No devolver automáticamente por cerrar una pestaña ni por descartar un intento.
8. **Pérdida de clientes:** avisos duplicados, estados mal rotulados, fallos de registro parcial y soporte sin historial accesible.
9. **Inconsistencia de métricas:** MRR del contrato activo no puede depender del último intento; bruto, neto, comisión, saldo liberado y banco son dimensiones distintas. La tasa estimada4,30% no es una tarifa verificada de MP; el neto informado por API tiene precedencia. Ver pagos.md.

## Documentos y alcance pendiente

- [Pagos, trial, estados y matriz de28escenarios](pagos.md).
- [Seguridad, aislamiento y permisos](seguridad.md).
- [Producto, UX, arquitectura, negocio, costes y crecimiento](producto-operaciones.md).
- [Inventario de rutas, acciones, tablas y variables](inventarios.md).
- [Rendimiento y evidencias ejecutadas](verificaciones.md).
- [Resultado HTTP por cada una de las28páginas públicas](http-publico.md).
- [Roadmap, monitoreo, pruebas y despliegue controlado](plan.md).
- [Revisión fiscal y de información al consumidor](legal.md).

La inspección y pruebas disponibles están documentadas. La auditoría de experiencia real y aceptación externa queda **parcial**: falta navegador con cuentas ficticias por estado, integración oficial sandbox, acceso de lectura a configuración/consumo/cron/backups y un ejercicio de restauración. No se presentan recorridos anteriores de otras sesiones como pruebas nuevas. No es necesario entregar claves: esas verificaciones se realizan mediante acceso seguro a herramientas/paneles y secretos fuera del informe.

## Decisión recomendada

Primera tanda, en rama separada y sin desplegar: FIN-01, FIN-02, etiquetas/conteos de cobros, deduplicación de bajas, confirmación admin, entorno fail-closed y límites2FA. Después, recuperación/alertas/restore y aceptación de sandbox. La aprobación para implementar debe ser explícita después de revisar este diagnóstico; no autoriza cobros, reembolsos, cancelaciones reales ni despliegue.
