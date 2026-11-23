# Mejora de producto autorizada — 18/11/2026

## Diagnóstico previo

- `MovementForm` ya sugiere categorías según historial, pero no guarda favoritos ni reglas personales. Cada nuevo formulario genera una clave de idempotencia; copiar un movimiento debe conservar una clave nueva y no su estado de pago anterior.
- Próximos ya agrupa atrasados, semana y meses. Se conservará ese recorrido, evitando crear una segunda lista o borrar coincidencias.
- El libro usa importes decimales y dirección, con aislamiento por espacio y bloqueo transaccional. Dividir una compra requiere que la suma de sus partes coincida exactamente con la salida real, escritura atómica e idempotencia. No se reutilizará el grupo de transferencias.
- Importar ofrece revisión de cantidades e idempotencia por archivo/concepto/fecha/importe, pero no muestra las filas ni ayuda a comparar con cargas manuales. La revisión debe vincularse al contenido confirmado y recalcularse antes de escribir.
- Presupuestos ya distingue gastos, pendientes, programados y estimación. El traslado de margen debe ser opcional, explícito, por mes y categoría; no debe simular dinero separado ni aplicarse al saldo bancario.
- Escenarios y guía inicial ya existen. Se ampliarán, sin duplicarlos. La calculadora básica de cuotas es Gratis y necesita una descripción pública coherente.
- Las preferencias pequeñas de uso pueden convivir con la configuración JSON del espacio bajo una clave identificada. Todas sus escrituras deben preservar las funciones existentes, bloquear el espacio y validar recursos y permisos. Se exportan y eliminan con el espacio, sin nueva migración.

## Alcance

Claridad común de pantallas, guía contextual, favoritos y carga parecida; resumen mensual gratuito; división explícita de gastos pagados; reglas personales Pro; revisión asistida de importación Pro; traslado explícito de margen Pro; costos anuales orientativos de recurrentes; supuestos y explicación de proyecciones y escenarios. Ayuda, bot, catálogo y textos públicos deben reflejar la implementación. No se incorporan conexiones bancarias, voz, OCR de tickets, asesor financiero externo ni inflación: se habían propuesto para después.

No se cambian cobros de Guafra, precios, trial, cancelaciones, credenciales o registros existentes. Sin migración. Las pruebas financieras se ejecutan con bases ficticias. Reversión por revertir la entrega, conservando el libro y configuración compatible.


## Implementación (terminada de preparar el 23/11/2026)

| Propuesta | Resultado y ubicación |
| --- | --- |
| Favoritos Gratis | Hasta 20 conceptos por espacio, cuenta y categoría. Importe siempre nuevo. `server/experience.ts`, `movimientos/preferencias/`. |
| Cargar uno parecido | Copia concepto, cuenta y categoría solo de un registro del espacio; genera nueva idempotencia y no copia importes, pagos, pendientes o recurrencias. `movimientos/nuevo/page.tsx`. |
| Dividir compras Gratis | De 2 a 10 categorías distintas, gasto pagado completo y suma decimal exacta. Todas las partes se escriben juntas; no se crea un asiento adicional por el total. Se identifican en la lista y el detalle permite recorrer las partes. Se corrigen y eliminan por separado. `ledger.ts:recordMovement`. |
| Resumen mensual Gratis | Ingresos, gastos netos, diferencia y categorías; mes económico y monedas separadas. No reemplaza al saldo ni al flujo. `app/resumen`. |
| Reglas Pro | Hasta 30 sugerencias por texto y sentido, editables antes de confirmar; no reclasifican historial. Se conservan sin usarse al volver a Gratis. `server/experience.ts`, `lib/experience.ts`. |
| Revisión de extractos | Filas paginadas, errores y omisiones explícitas. Coincidencias Pro por cuenta, signo, importe y fecha cercana; reconoce el total de una compra dividida. No fusiona registros. Filas idénticas del archivo se proponen para omitir, pero pueden incluirse si son operaciones distintas. La clave de ocurrencia conserva su idempotencia. `import-review.ts`, `importar/`. |
| Integridad de importación | Confirmación ligada a archivo, cuenta y coincidencias, recalculada bajo bloqueo del espacio. Un lote se guarda completo o se revierte completo. Inserción en bloque y contador real; dos pestañas no duplican el lote ni los movimientos. Tope explícito 2.000 filas / 5 MB. Centavos con half-even, sin filas que redondeen a cero. `io.ts:applyImport`, acciones de importación. |
| Traslado Pro | Revisión de mes terminado, límite anterior + margen positivo descontando lo reconocido. Solo a mes siguiente sin límites. Revisión desactualizada o destino ocupado se rechazan; no se toca saldo ni se repite automáticamente. Recibo del último traslado en configuración del espacio. `budget-carry.ts`, `presupuestos/trasladar`. |
| Costos Pro | Gastos recurrentes activos y suscripciones de tarjeta por moneda. Equivalente anual con frecuencia e intervalo; usa importe a la fecha de cálculo. No considera cambios futuros o fecha de fin y no cancela servicios. `recurring-costs.ts`, `recurrentes/costos`. |
| Flujo y escenarios | Detalle mensual paginado por origen y certeza. Supuestos, alcance de 12 meses y mes del mínimo en escenarios. No se cambian fórmulas. |
| Usabilidad transversal | Guías desplegables para las áreas existentes; resumen accesible desde Inicio, Movimientos y Revisión. Próximos conserva su agrupación existente; bienvenida conserva intereses y opción de omitir; evita duplicar esos recorridos. Formularios móviles con importes/conceptos apilados y casillas de ancho fijo. |
| Revisión y cuentas | Próximo paso según saldos, atrasos y categorías; sin declarar completos los datos. Fecha de revisión visible en cada cuenta. |
| Valoraciones | Fuente y fecha de precio visibles; si falta conversión y se usa precio manual, su fecha y variación corresponden realmente a ese precio. No se anuncia una cotización vieja como «hoy». |
| Alertas | Solo consejos informativos pueden posponerse 7 días en ese navegador. Vencimientos y avisos críticos no se ocultan. |
| Ayuda y bot | Ocho temas nuevos compartidos entre FAQ y bot; derivación sensible conservada. Guías de cada área y separación Gratis/calculadora frente a Pro/escenarios. |
| Textos públicos | Catálogo actualizado sin cambiar precios o acceso existente. Términos explican confirmaciones y estimaciones; Privacidad y Cookies describen preferencias, archivos y consejos locales. Se mantienen pagos, bajas y reembolsos vigentes. |

La configuración de funciones se guarda bajo bloqueo preservando los favoritos/reglas agregados desde otra pantalla. Estos datos conviven con el JSON del espacio bajo claves identificadas, se exportan en el respaldo y se eliminan con el espacio. No se agrega una base, proveedor o migración.

## Validación y límites

- Integración con base ficticia: aislamiento, permisos Pro/Gratis, centavos, reintegros de una parte, dos envíos concurrentes, suma de partes, presupuestos, reportes y conservación de saldos.
- Acciones de servidor con autenticación simulada: rol de lectura bloqueado, categoría/cuenta ajena rechazada, revisión obligatoria, confirmación válida, extensiones Pro y división manipulada.
- Importación: fallo intermedio sin lote ni registros parciales, dos pestañas, filas idénticas legítimas, cambio desde la revisión y redondeo half-even.
- Valoración manual usada por falta de conversión conserva su fecha y no muestra una variación de otro precio.
- Navegador real sobre base aislada: favorito guardado en 390 px, compra de 80,50 repartida en 60,25 y 20,25, identificación de partes en Movimientos. Resumen en 320 px. Importación en 430 px con un error de fecha y una coincidencia con compra dividida: se omite la compra y el lote guarda solo el ingreso nuevo de 10.000.
- Se detectó y corrigió un estilo que estiraba casillas en el formulario de importación. Se apilaron importe/concepto en celulares para no angostar el concepto.
- Captura propia en `.data/chat-qa/resumen-movil-producto-20261123.png` (ficticia, ignorada por Git).
- El navegador integrado no estuvo disponible el 23/11; se usó Brave mediante controles de Windows. No se simularon métricas de rendimiento de campo ni dispositivos físicos.
- La revisión de textos se limita a describir el producto y su tratamiento de datos, sin cambiar derechos o atribuir certificaciones legales. Se consultó la guía primaria de AAIP sobre informar finalidad y tratamiento: https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones

Las mejoras generales de tarjetas, deudas, patrimonio, Agro, objetivos y compartir aprovechan sus controles y recorridos existentes y añaden guía contextual: no se inventa una nueva conciliación bancaria o un asesor externo. Inflación, conexión bancaria, voz y OCR de tickets siguen fuera de esta entrega, como en la propuesta original.

## Despliegue y reversión

1. Revisar diff y tipos; aprobar suite completa y compilación/smoke en CI del commit exacto. Preview de la rama deshabilitada para evitar infraestructura compartida.
2. Fusionar y comprobar despliegue y salud. Solo lectura sobre producción; no probar registros financieros con datos reales.
3. Para revertir: revertir la entrega y publicar. No restaurar base ni borrar movimientos nuevos. Las partes son registros EXPENSE normales, compatibles con la versión anterior. La configuración adicional se conserva aunque una versión anterior no muestre las herramientas; guardar funciones antes de reactivar la versión nueva podría quitar estas preferencias en una versión antigua.

Revisión final adicional: elegir un favorito conserva el estado Pendiente (comprobado en navegador sin guardar). No copia una división anterior. El editor de preferencias conserva su tipo seleccionado después de guardar y la importación limpia la revisión al agregar un nuevo lote.
