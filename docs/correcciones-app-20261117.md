# Correcciones autorizadas de la aplicación

El usuario autorizó corregir y publicar los hallazgos de `auditoria-usabilidad-app-20261117.md`, además de Presupuestos. Esta entrega mantiene el diseño, el modelo de planes y las decisiones previas sobre soporte.

## Resolución del diagnóstico

| ID | Cambio | Evidencia |
| --- | --- | --- |
| A01 | Deudas agrupadas por moneda; cuotas del mes y atrasadas restan pagos parciales. | `financial-summaries.ts:debtSummary`, página Deudas. |
| A02 | Totales de cuenta agregados sobre todos los registros del mes; lista independiente a 50 por página. | `financial-summaries.ts:accountActivity`, detalle de Cuenta. |
| A03 | PDF usa los mismos signos, categorías y mes económico que Informes. Reintegros reducen el gasto. | `financial-summaries.ts:monthlyReport`, `io.ts:categoryReport`, página Reporte. |
| A04 | Excel de Informes conserva meses, moneda base y cuenta; PDF conserva cuenta y mes indicado. Exportación completa sigue disponible en Importar. Cuenta ajena devuelve 404 y permisos Pro siguen en servidor. | `exportar/excel/route.ts`, `io.ts`, páginas Informes y Reporte. |
| A05 | En la app móvil, Guafra se abre desde la cabecera: no queda un lanzador flotante sobre cifras. Landing y mantenimiento conservan el lanzador. | `shell.tsx`, `mobile.css`, `guafra-chat.module.css`. |
| A06 | Historial con búsqueda por código/asunto, 15 casos por página, orden estable y origen diferenciado. Un único buscador reemplaza los dos campos redundantes. | `chat-case-page.ts`, API de chat y widget. |
| A07 | Búsqueda de inversiones distingue conexión fallida de cero coincidencias, ofrece reintento, corta a 7 segundos y descarta búsquedas anteriores. Las referencias no se anuncian como cotizaciones garantizadas de hoy. | `inversiones/ticker-input.tsx`. |
| A08 | Meses restringidos a 01–12 y fechas de rango/día validadas antes de consultar. Un mes inválido vuelve al mes actual. | `dates.ts:validPeriod`, Movimientos, Calendario y Reporte. |
| A09 | «Registrar ahorro» explica que anota dinero ya separado, sin hacer transferencias ni cambiar saldos. | Objetivos, Ayuda y respuesta de Guafra. |
| A10 | Formularios de simulación enviados por POST; importes cifrados, cálculo vinculado a usuario y espacio, vencimiento de una hora. No se guardan simulaciones transitorias en la base. Los escenarios guardados por ID se conservan. | `private-simulation.ts`, `simulador/actions.ts`, página Simulador. |
| A11 | Historial de importaciones paginado a 20 lotes, con cantidad y estado. Deshacer sigue requiriendo confirmación. | página Importar. |
| A12 | Inicio identifica el disponible como saldo menos pagos cargados; su enlace de fin de mes lleva al flujo confirmado. Se aclara la diferencia con estimaciones y presupuesto. | páginas Inicio, Flujo y Ayuda. |

También se agregan filtro de categoría en Movimientos, totales coherentes con filtros, grupos de Alertas y avance de los tres controles automáticos de Revisión del mes. El cuarto paso conserva revisión manual de ingresos y gastos futuros; no se declara completado por existir registros.

## Hallazgos adicionales de las pruebas

- Una cuota parcialmente pagada sin interés no reducía el capital mostrado. Se corrigió en `debtDetail`, conservando pagos y cronograma. Para cuotas con intereses/cargos, el capital se estima proporcionalmente al cronograma de la cuota, y se explica como estimación. No implica conocer la imputación real del banco: el saldo de cancelación debe confirmarse con el acreedor. La app no ejecuta transferencias bancarias por estas acciones.
- En móvil, el PDF tenía 484 px de ancho sobre un viewport de 390. Ahora los totales se apilan y las tablas desplazan dentro de su sección. Se verificó documento de 375 px; el formato de impresión conserva sus tres columnas.
- La cabecera podía emitir la apertura del chat antes de que el widget estuviera listo. Se conserva una intención de apertura y se consume una sola vez al montar el widget; también conserva el código del caso solicitado.

## Validación realizada

- Pruebas con PostgreSQL compatible en memoria y datos ficticios: separación de monedas, parcialidades y reversa, más de 100 movimientos, reportes con devolución, exportación filtrada, aislamiento, historial antiguo, fechas inválidas y cálculos privados.
- Pruebas de rutas: Pro en servidor, cuenta ajena, filtros inválidos, descarga privada, autenticación y permisos de escenarios. Vencimiento, alteración y otro usuario/espacio no abren el cálculo.
- Navegador local con cuenta ficticia Pro: deuda ARS 12.000 con pago parcial 1.000 muestra capital 11.000 y cuota restante 3.000; deuda USD se presenta separada. Cuenta con 153 registros muestra totales completos y cuatro páginas.
- PDF e Informes conservaron cuenta y noviembre; gastos netos 152.510 en la demostración. No se imprimieron ni descargaron datos reales.
- Historial de 30 casos: segunda página accesible y búsqueda del primer formulario por código correcta. El chat vuelve a Inicio al cerrar; no se registró una nueva consulta ni se enviaron mensajes.
- Simulación ficticia de 12.000 en seis cuotas: resultado mostrado sin importe visible en URL. Escenario con ingreso extra de 20.000 refleja diferencia de 20.000 y tampoco muestra el importe en la dirección.
- Importaciones ficticias: 25 lotes, página 2 con cinco lotes anteriores. No se deshizo ninguna importación real.
- Pantallas modificadas verificadas a 320, 390 y 430 px sin desbordamiento horizontal del documento. Evidencias locales en `.data/chat-qa/`, con datos ficticios.
- Una conexión de la base local se cerró durante recarga de desarrollo; al recargar se recuperó. No se reprodujo en producción ni se atribuye a una falla de producción.
- El comportamiento de error del buscador de inversiones se revisó en código; no se provocó una caída del proveedor externo.

## Publicación y reversión

La propuesta #16 contiene Presupuestos y estas correcciones. No hay migración, dependencia nueva, secreto nuevo ni reescritura masiva de datos. Antes de fusionar: CI del SHA exacto con TypeScript, suite completa, compilación y smoke HTTP. Después: despliegue Vercel, salud de producción y lectura de las pantallas modificadas. Revertir el merge y redesplegar si falla; no requiere rollback de base.

No se realizaron cobros, reembolsos, cancelaciones de Mercado Pago ni cambios de DNS. Los correos siguen siendo avisos para volver al chat. La recepción por correo y el cierre automático de reclamos siguen desactivados según decisiones anteriores. No se cambia el régimen fiscal ni se activan planes pagos de infraestructura.

Los enlaces antiguos de simulación con importes explícitos piden recalcular para usar el formato privado. Los cálculos cifrados requieren la misma cuenta y espacio y vencen después de una hora; para conservar un escenario se usa el guardado existente. Esto no borra escenarios ni movimientos.
