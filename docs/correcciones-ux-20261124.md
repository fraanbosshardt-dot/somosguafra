# Correcciones de la revisión UX — 24/11/2026

## Alcance

Implementación de los 15 hallazgos de `auditoria-ux-ui-20261124.md`, aprobada por el usuario. No incluye la tabla de funcionalidades futuras ni cambia precios, el cálculo de presupuestos o las operaciones del proveedor de pagos. No hay migraciones.

## Cambios

| Hallazgos | Resultado | Ubicación |
| --- | --- | --- |
| UX-01, UX-02 | Título, mes y guía separados. Guía optativa y compacta desde el primer uso. Sin límites, se muestra primero el editor; con límites, resumen y categorías. Copia y traslado en Opciones del mes. | `components/page.tsx`, `components/product-guide.tsx`, `app/app/presupuestos` |
| UX-03, UX-06 | Los gates no abren recorridos de funciones bloqueadas. La oferta de trial usa la misma condición del servidor que su activación, incluyendo contratos pendientes y rol dueño. | `components/pro.tsx`, `server/plans.ts` |
| UX-04, UX-10, UX-14 | Se conserva mensual/anual al ir de la landing al plan con contratación pendiente; no se crea otra operación por navegar. Se quita enlace secundario duplicado en estados sin contratación directa. Enlaces claros sobre la tarjeta oscura. Continuación de solicitud con nombre explícito. | `components/app-cta.tsx`, `lib/plan-navigation.ts`, `components/plan-subscription-card.tsx`, `app/landing.css` |
| UX-05 | Ajustes muestra todas las secciones con salto de línea en escritorio y conserva selector móvil. | `components/settings-navigation.tsx` |
| UX-07 | Etiquetas Pro solo cuando falta acceso en traslado, costos y reglas. | Presupuestos, recurrentes, preferencias |
| UX-08, UX-09 | Revisión enlaza la tarea pendiente concreta. Conteo excluye reglas pausadas o terminadas y corrige singular/plural. Filtro sin categoría por mes económico; no incluye transferencias. | `app/app/revision/page.tsx`, `lib/review-next-step.ts`, `app/app/movimientos/page.tsx` |
| UX-11 | Búsqueda visible; filtros avanzados plegables con indicación de selección activa y acciones separadas. | `app/app/proximos/page.tsx` |
| UX-12 | Edición de categorías y recurrencias en panel modal desplazable; conserva borrador al cerrar, devuelve foco y mantiene confirmación antes de borrar. | `components/edit-panel.tsx`, `components/confirm-submit.tsx`, categorías, recurrentes |
| UX-13, UX-15 | Ayuda agrupada por tarea con búsqueda y filtros. Primer favorito visible para listas vacías. Ayuda y respuestas del bot describen guía y traslado actuales. | `components/help-faq.tsx`, `components/support-guide.tsx`, `lib/product-help.ts`, preferencias |

El acceso general desde la landing se llama «Mi espacio», para no sugerir una aplicación exclusiva de celular.

## Verificación

- TypeScript local: correcto.
- Regresión nueva: 7 pruebas correctas, con base PostgreSQL ficticia en memoria. Cubren conservación del ciclo, elegibilidad del trial, permisos, siguiente tarea, conteo de recurrencias y filtro de movimientos.
- Pruebas existentes dirigidas de planes públicos y chatbot: 48 correctas.
- Navegación local en Brave con datos ficticios: ingreso, presupuesto existente, guía abierta/cerrada, escritorio y emulación de 440 × 956 y 375 × 667. Mes independiente de la guía y resumen legible.
- La primera prueba local en modo desarrollo entró en recargas y perdió una conexión de la base ficticia. Se detuvo y se construyó una versión de producción local aislada. En esa versión el navegador integrado ingresó y navegó correctamente, sin recargas en vivo. No se considera demostrada la causa de la falla del entorno de desarrollo.
- En la versión estable local se verificaron: presupuesto existente y mes sin límites; creación de una recurrencia ficticia y guardado de edición; modal móvil; borrador conservado al cerrar y reabrir; confirmación de borrado visible sobre el modal y Escape que la cancela conservando el panel. No se confirmó ningún borrado. Búsqueda de Ayuda y filtro alfabético de Próximos correctos. La revisión detectó la navegación de Ajustes duplicada en móvil por cascada CSS; se corrigió su visibilidad.
- Primer CI del PR: 82 archivos / 581 pruebas correctas, TypeScript, build y check-build correctos. Las adiciones posteriores requieren nuevamente CI en su commit exacto antes de integrar.

## Incidente comunicado durante la entrega

El usuario aportó un aviso de UptimeRobot del 24/11/2026: 503 confirmado por varias regiones entre 06:27:46 y 06:32:52 (Argentina). La comprobación posterior respondió 200 con `ok: true`. Este endpoint ejecuta `SELECT 1`; el 503 de su implementación indica que falló el acceso a la base, pero no distingue red, pool, credenciales o disponibilidad. No se ha demostrado una causa raíz. El aviso precede a la publicación de esta entrega.

Railway CLI permitió consultar el servicio Postgres: último deployment exitoso del 07/11/2026; sin mensajes de reinicio, caída o recuperación en el intervalo 09:23–09:35 UTC consultado. Ausencia de registros no descarta un problema. El conector Railway requiere reconexión; no se cambió configuración ni se reinició producción.

Se incorpora `reportError("health.database", error)` en el catch del healthcheck: registra solo tipo y código técnico permitidos. Conserva el 503, la respuesta pública mínima y la política no-store. Dos pruebas validan respuesta sana y falla sin filtrar credenciales ni metadatos.

## Límites y reversión

La emulación no verifica Safari ni teclado virtual en un celular físico. No se hicieron cobros, cancelaciones, reembolsos ni cambios financieros reales. La comprobación visual no certifica todas las variantes Pro ni ausencia total de errores. No cambian finalidades de datos personales ni condiciones comerciales; no se modifica documentación legal sin una razón material.

Reversión: revertir el commit de esta entrega y volver a desplegar. Sin migraciones ni transformaciones de datos que revertir. Se conservan los endpoints y las validaciones de las acciones existentes.
