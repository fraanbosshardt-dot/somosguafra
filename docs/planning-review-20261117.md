# Revisión de planificación — 17 de noviembre de 2026

## Diagnóstico antes de modificar

- `src/server/recurring.ts`: materialización protegida por la combinación regla/fecha. `projectedItems` excluye ocurrencias ya guardadas, incluso canceladas. Dos reglas independientes o una carga manual y una regla pueden compartir concepto, fecha e importe; eso requiere revisión, no borrado automático.
- `prisma/schema.prisma`: unicidad de `recurringRuleId/occurrenceDate` e idempotencia de movimientos por espacio. Una consulta agregada de solo lectura encontró coincidencias entre registros sin regla y superposiciones con reglas. No se infirió la intención de cada operación ni se modificaron registros.
- `src/server/planning.ts:budgetFor`: gasto real desde transacciones EXPENSE; comprometido desde saldos pendientes. `saveBudget` guarda límites, no crea gasto ni obligaciones.
- `src/server/forecast.ts:forecast`: proyecta pendientes, reglas recurrentes y tarjetas. No consulta límites presupuestarios.
- `src/app/app/presupuestos/page.tsx`: porcentaje de gasto real separado de pendientes. Un límite aislado no debe mostrar 100% gastado. La causa del caso del usuario aún requiere identificar los movimientos concretos, su categoría y período.
- `src/app/app/objetivos/page.tsx`: no existía edición de nombre, meta o fecha.

## Cambios preparados

1. Navegación y título: Próximos pagos y cobros.
2. Búsqueda por concepto sin distinguir acentos; orden por fecha o alfabético global.
3. Filtro de posibles repetidos y señal «Revisar coincidencia»: mismo nombre normalizado, dirección, fecha, moneda e importe original. No se consideran duplicados pagos de diferentes meses, ni se eliminan o fusionan automáticamente. El detector es orientativo: no compara contraparte, cuenta de origen ni intención del usuario, y puede omitir nombres diferentes.
4. En la vista de revisión, botón Cancelar explícito con la confirmación existente. La cancelación de una ocurrencia proyectada conserva los filtros. No se creó cancelación masiva ni se modificó el servicio contable de cancelación.
5. Nombre de cada recurrente destacado; opciones de edición con jerarquía secundaria.
6. Editar objetivo: nombre, meta, fecha y aporte mensual previsto. Moneda e historial de aportes inalterados. Actualización restringida al espacio autenticado, sin movimientos de dinero. Una meta inferior al ahorro puede quedar cumplida.
7. Vista previa de esta rama deshabilitada para evitar utilizar infraestructura compartida antes de revisión. Sin migraciones ni cambios de fórmulas del flujo.

## Integración aprobada: presupuesto como estimación

Para todas las categorías, no solamente alimentación:

- Opción explícita por presupuesto para considerar el saldo disponible en la proyección. Desactivada para presupuestos existentes.
- Separar límite, gasto real, comprometido y estimación restante.
- Ejemplo: límite 500.000, compras 120.000, pendientes 30.000: estimación restante 350.000. Nunca mostrar los 500.000 como gasto real por haber fijado un límite.
- Cada compra real consume el límite; el remanente disminuye sin crear gastos ni pagos ficticios.
- Mostrar la estimación a fin de mes con una etiqueta propia; no asignarle una fecha de vencimiento real ni modificar el saldo bancario.
- Antes de implementar, cubrir tarjetas y cuotas (consumo económico vs fecha de salida de caja), compras de meses anteriores, reglas aún no materializadas, pagos parciales, reintegros, exceso de presupuesto y monedas diferentes. No descontar dos veces pagos ya incluidos en el flujo.
- Definir si aplica solo al mes seleccionado y cómo se copia al siguiente. No replicar automáticamente todos los límites hacia meses futuros.
- No convertir un gasto ya contabilizado en estimación sin revisar su origen y la autorización del usuario.

## Validación

- Pruebas de integración con PostgreSQL en memoria: editar objetivo conserva aportes, moneda y movimientos; rechaza objetivo ajeno y valores inválidos.
- Diagnóstico reproducido: límite 500.000 no crea gasto ni evento de caja; compra 120.000 + pendiente 30.000 deja 350.000 disponible.
- Revisión: meses, monedas, direcciones e importes diferentes no coinciden; búsqueda y orden no mutan la lista de entrada.
- Pruebas recurrentes existentes: materialización, proyección, cancelación de ocurrencia y conservación de pagos registrados.
- Navegador local, datos ficticios: filtros, orden A–Z, botones explícitos, móvil 390 px sin desbordamiento; editar una meta de 500.000 a 600.000 conserva 120.000 de ahorro y actualiza el avance de 24% a 20%; nombre recurrente legible.
- Suite local: 506 aprobadas, 2 omitidas que requieren entorno de integración. TypeScript aprobado. El build Turbopack local encontró la limitación de dependencias compartidas por junction del worktree; se valida además con Webpack local y con el build normal en CI, sin cambiar la configuración de producción.

## Publicación y reversión

La implementación fue autorizada por el usuario después del diagnóstico. Migración aditiva `20261117010000_budget_projection`: agrega `BudgetLine.projectRemaining` con valor predeterminado false. No cambia límites, registros contables ni opciones existentes.

Publicación: respaldo cifrado previo y verificado, CI completo sobre el commit exacto, merge y despliegue automático con migración previa al arranque. Comprobar salud, migración, preservación de registros y páginas privadas/públicas.

Reversión: revertir el código y desplegar la versión anterior; conservar la nueva columna (compatible con el cliente anterior) y todos los objetivos, aportes y registros. No restaurar el respaldo sobre datos nuevos para revertir solamente esta función. Desactivar una categoría deja de proyectar el remanente sin borrar movimientos.

## Funcionamiento definitivo y límites

- Opción por categoría y mes, desactivada por defecto. Copiar el mes conserva el importe exacto y la opción; no se extiende a meses sin presupuesto.
- Remanente = máximo(0, límite − máximo(0, gasto neto de categoría/mes) − pendientes no asociados a resumen − recurrentes todavía no materializados − suscripciones de tarjeta todavía no registradas).
- Las ocurrencias existentes de una regla, cualquiera sea su estado, impiden volver a reservarla como virtual. Los pagos parciales se reparten entre gasto real y saldo pendiente. Los meses vencidos no agregan estimaciones futuras.
- El remanente se agrega como evento `budget`, PROBABLE, al último día de su mes. Solo se ve en proyecciones; «Solo lo confirmado» lo excluye. No genera obligaciones ni transacciones.
- Compras con tarjeta consumen el límite en el período económico de la compra (en cuotas, por el total); el flujo conserva el vencimiento real del resumen/cuota. Pagar el resumen es transferencia y no consume otra vez el presupuesto. Las cuotas antiguas se suman al efectivo necesario del nuevo mes, sin consumir el presupuesto de compras nuevas.
- Los consumos futuros aún no realizados se suponen salida al fin de mes, sin inventar un vencimiento de tarjeta. Un resumen cargado solo por total no permite distribuir gasto entre categorías; la app explica que hace falta el detalle.
- Las categorías sin límite, divisas distintas y datos de otros espacios se mantienen separados. Las compras de subcategorías archivadas siguen consumiendo el límite de su categoría principal activa.
- Los reintegros reducen el gasto neto; la estimación adicional no puede exceder el límite. Un exceso deja remanente cero, nunca un ingreso artificial.
- Se conservan centavos en el editor, el guardado y la copia; el servidor sigue usando importes decimales exactos.
- Ayuda, glosario y guía del bot actualizados. El bot distingue revisar registros de un reclamo de cobro real, que deriva a una persona. Las respuestas personalizadas por el dueño conservan su prioridad.

Pruebas nuevas: 13 casos de integración/ruteo, además de los 5 de revisión y edición. Cubren tarjetas con vencimiento posterior, cuotas de otro mes, suscripciones a más de 40 meses, cierre y pago parcial/total del resumen, anulaciones, reintegros, copia con centavos, aislamiento y valores inválidos. Suite local inicial con la integración: 517 aprobadas y 2 omitidas; los dos casos agregados después se verificaron en la ejecución enfocada. CI completo debe confirmar el total final antes de publicar.
