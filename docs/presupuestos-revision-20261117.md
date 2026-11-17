# Revisión de Presupuestos — 17 de noviembre de 2026

## Alcance y evidencia

Diagnóstico sin modificar cálculos, registros financieros ni configuración de producción. Se revisaron la pantalla autenticada de Presupuestos y su editor en producción, el código y Ayuda. Se ejecutó `npm test -- tests/budget-projection.test.ts`: 13 pruebas aprobadas. No se crearon compras, pagos ni presupuestos reales.

La publicación anterior del panel quedó en main `defa978a763bf23d930bae67a66dd16e5fa15d0d`, con CI de 526 pruebas, despliegue Vercel y control de producción 44139427361 exitosos. La sesión administrativa había vencido al intentar la comprobación visual final de Sistema; ese texto fue verificado anteriormente en el entorno ficticio. La modalidad elegida sigue siendo respuestas en chat y avisos por correo, sin activar recepción por email.

## Modelo actual

- Un límite mensual por categoría principal de gasto, en la moneda base. Las subcategorías acumulan en su categoría principal.
- Los gastos consumen según su mes económico; un pendiente consume por el importe restante. Un reintegro reduce el gasto neto.
- Un presupuesto no mueve dinero ni genera un pago. Las categorías sin límite se muestran separadas.
- Se puede activar por categoría la estimación del remanente en Flujo de caja: límite menos gastos, pendientes y programación conocida, con mínimo cero. No aumenta por encima del límite por reintegros netos.
- La estimación es probable y se coloca al final del mes. Se excluye en «Solo lo confirmado». No predice el vencimiento de futuras compras con tarjeta.
- Copiar al mes siguiente conserva límites y opciones; no copia los gastos ni extiende automáticamente todos los meses futuros.
- Compras con tarjeta cuentan por categoría; pagar el resumen no vuelve a consumir el presupuesto. Una compra en cuotas consume el total en el mes de compra; las cuotas afectan caja en sus vencimientos. Un resumen solo por total no permite repartir categorías.
- Inicio calcula «Te queda hasta tu próximo cobro» con saldo y pendientes existentes. No descuenta el remanente estimado de presupuestos. Tampoco equivale a la proyección probable de fin de mes.

Evidencia: `src/server/planning.ts:budgetFor/saveBudget/copyBudget`, `src/server/budget-projection.ts:budgetProjection`, `src/server/forecast.ts:forecast`, `src/app/app/presupuestos/page.tsx`, `src/app/app/presupuestos/budget-editor.tsx`, `src/app/app/page.tsx`, `src/app/app/ayuda/page.tsx` y `src/lib/chat-help.ts`.

## Ejemplo ficticio

Alimentación: límite $500.000, compras reales $150.000, pedido pendiente $50.000. Margen restante $300.000.

Con proyección activada, el flujo incluye los $50.000 pendientes y $300.000 adicionales estimados; no agrega otro gasto de $500.000. Al pagar el pedido, gastado pasa a $200.000, pendiente a cero y el margen sigue siendo $300.000. Una compra adicional de $20.000 reduce el margen y la estimación a $280.000.

Para usarlo no corresponde crear otro gasto estimativo por el límite completo. Si ya existe uno, se debe revisar su origen y estado antes de corregirlo; no eliminar automáticamente posibles gastos reales.

## Hallazgos y mejoras propuestas

| ID | Evidencia | Diagnóstico | Cambio recomendado | Validación |
| --- | --- | --- | --- | --- |
| B01 | `planning.ts:budgetFor`, `budget-projection.ts:budgetProjection` | Confirmado por lectura: la programación no materializada llega al presupuesto solo para categorías con proyección activada. Activar una estimación puede cambiar el margen mostrado por un compromiso que ya existía. El layout materializa recurrentes hasta 45 días; limita algunos casos cercanos, pero no elimina la diferencia en meses futuros o suscripciones aún no cargadas. No reproducido en datos de producción. | Separar el cálculo de compromisos del permiso para proyectar el remanente. | Mismos gastos, pendientes y programados con opción activada/desactivada; solo cambia el evento estimado en flujo. Probar recurrentes y suscripciones antes/después de materializar. |
| B02 | `presupuestos/page.tsx`, `planning.ts:budgetFor`, `insights.ts` | Confirmado: color/porcentaje de tarjeta usa gastado; alertas usan gastado más pendiente y omiten programación. Puede aparecer «Te pasaste» sin haber gastado todavía el límite. | Mostrar consumo real y comprometido separados; aviso «Vas a superar el límite» para exceso previsto. Compartir cálculo. | Casos 80%, 100%, exceso real, exceso solo pendiente y solo programado; coherencia de tarjetas y alertas. |
| B03 | `app/page.tsx`, `presupuestos/page.tsx`, `forecast.ts` | Confirmado: «Te queda» representa magnitudes distintas en Inicio y Presupuestos; la proyección probable tampoco es el saldo bancario. | «Margen del presupuesto», «Disponible descontando pagos cargados» y «Saldo proyectado» con explicación breve. No descontar arbitrariamente todo el mes antes del próximo ingreso. | Usuario identifica qué incluye cada cifra; próximo cobro antes/después de fin de mes y comparación con flujo confirmado/probable. |
| B04 | `actions/modules.ts:copyBudgetAction` | Confirmado: captura y silencia todo error, incluso ausencia de presupuesto anterior. | Confirmación explícita y error útil; estado de carga. | Mes anterior vacío, copia exitosa, categoría archivada y fallo temporal conservando datos. |
| B05 | `presupuestos/page.tsx` promedio previo, `budget-editor.tsx` | Confirmado: divide siempre entre tres meses; una cuenta con un solo mes puede recibir una sugerencia baja presentada como «Gastás ... por mes». | Mostrar período y cobertura de la sugerencia; distinguir meses vacíos de historial insuficiente. Mantener edición manual. | Cuenta nueva, un mes, tres meses, reintegros y sin gastos. |
| B06 | Tarjetas de categoría de `presupuestos/page.tsx` | Mejora de usabilidad: falta abrir desde el número el detalle de los movimientos y compromisos que lo explican. | Accesos «Ver gastos» y «Ver previstos», con mes/categoría y sin mezclar monedas. | Suma del detalle coincide con tarjeta, subcategorías y pagos parciales incluidos. |

## Orden recomendado

1. Unificar cálculo y significado de gastado, pendiente, programado y margen (B01/B02). Pruebas de regresión antes de cambios visuales.
2. Presentar cuatro cifras por categoría: límite, gastado, previsto y margen. Explicar proyección con su importe exacto. Resolver copia y feedback (B03/B04).
3. Agregar detalle verificable y mejorar sugerencias (B05/B06). Mantener tarjetas compactas, con explicaciones ampliables en móvil.
4. Actualizar Ayuda y respuestas del bot junto con cada cambio. Opcional posterior: copiar presupuestos a varios meses mediante selección y confirmación, sin generar gastos.

No se propone modificar ahora el criterio de compras en cuotas, convertir presupuestos en sobres bancarios ni crear pagos automáticos. Requieren decisiones de producto separadas para conservar compatibilidad.

## Pruebas ya ejecutadas y límites

Las 13 pruebas actuales cubren proyección activada/desactivada, saldos sin mutación, ausencia de pagos ficticios, pago parcial/total sin duplicación, recurrentes, subcategorías, reintegros, tarjeta/resumen/cuotas, moneda y aislamiento entre espacios, validaciones, centavos y copia. Pasaron el 17/11/2026.

No equivalen a haber reproducido B01–B06 en todas las pantallas/dispositivos o cuentas de producción. Esta revisión no añadió pruebas ni modificó la lógica. Las mejoras anteriores son propuestas para una siguiente implementación controlada.
