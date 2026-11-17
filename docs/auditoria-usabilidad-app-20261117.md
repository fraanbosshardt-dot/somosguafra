# Revisión de la aplicación: claridad, funciones y errores

Fecha: 17/11/2026. Alcance autorizado: implementar Presupuestos y su ayuda relacionada; auditar las demás áreas sin corregirlas ni cambiar datos reales.

## Qué se comprobó

- Recorrido autenticado de producción en escritorio de 1280 px y celular de 390 × 844: Inicio, Movimientos, Cuentas, Revisión del mes, Próximos pagos y cobros, Tarjetas, Deudas, Flujo, Objetivos, Simulador, Patrimonio, Inversiones, Informes, Alertas, Recurrentes, Categorías, Importar, Plan, Seguridad, Compartir, Funciones, Ayuda, Calendario y Cereal. Presupuestos se había inspeccionado en producción durante el diagnóstico y su versión nueva se probó con datos ficticios.
- En las 24 vistas medidas no hubo desbordamiento horizontal del documento. No prueba por sí solo que todos los desplegables, tablas y teclados móviles estén bien.
- Código de páginas, cálculos relacionados, límites de consultas, ayuda, permisos y chat. No se hicieron altas, pagos, cancelaciones, modificaciones de seguridad ni envíos reales.
- Chat con cuenta ficticia: Inicio, historial, abrir un caso existente, formulario para equipo sin conversación detrás, cerrar y volver a abrir en Inicio. No se registró una nueva derivación ni se envió una respuesta.
- Pruebas automatizadas del repositorio con bases ficticias. El resultado definitivo se registra en la propuesta de cambios de Presupuestos.

No se auditó visualmente el panel administrativo en esta fase: su sesión separada estaba vencida. Los controles del panel corresponden al trabajo previo. Tampoco se verificó un ciclo real de Mercado Pago o una integración sandbox: el usuario había decidido posponerlo. No afirmar que esta revisión equivale a una auditoría de penetración ni a mediciones de rendimiento de campo.

## Problemas concretos pendientes de autorización

«Confirmado en código» significa que la implementación contiene la condición descrita; no que los datos actuales de producción ya estén afectados.

| ID | Prioridad / estado | Problema y evidencia | Impacto | Solución propuesta y validación |
| --- | --- | --- | --- | --- |
| A01 | P1 · Confirmado en código | `src/app/app/deudas/page.tsx:24`: «Falta pagar este mes» suma cuotas de todas las monedas, pero se presenta con `formatMoney(thisMonth, cur)`. El capital sí se filtra por moneda. | Sumar ARS y USD como si fueran equivalentes produce un total engañoso. | Separar por moneda o convertir con cotización explícita, sin modificar las deudas. Probar dos préstamos de monedas distintas, atrasos y cuotas parciales. |
| A02 | P1 · Confirmado en código | `src/app/app/cuentas/[id]/page.tsx:45–50`: entró/salió del mes se calcula sobre los últimos 100 movimientos, no sobre todos los del mes. | Al superar 100 registros puede subestimar los totales; el saldo utiliza otro cálculo y puede seguir correcto. | Agregados completos en base y lista paginada independiente. Probar 101 y 250 movimientos de un mes, transferencias y reversas. |
| A03 | P1 · Confirmado en código | `src/app/reporte/page.tsx:29–33` suma importes positivos sin aplicar `direction`; `src/server/io.ts:categoryReport` sí aplica signos. Además, PDF filtra por fecha efectiva y el informe por mes económico. | Una devolución real de un gasto puede aumentar el gasto en el PDF. Ejemplo ficticio: compra 100 y devolución 20 podrían dar 120 en lugar de 80. El mes también puede diferir legítimamente, pero no se explica. | Unificar o nombrar explícitamente base de cálculo y signos. Probar compra, devolución, reversa y gasto de octubre pagado en noviembre. No cambiar los registros. |
| A04 | P2 · Confirmado en código | `src/app/app/informes/page.tsx:48`: Excel y PDF enlazan sin filtros; Excel exporta todos los movimientos y PDF abre el mes actual sin cuenta seleccionada. | La descarga puede no representar lo que el usuario estaba mirando. No es acceso entre cuentas ajenas. | Botones claros «Exportar todo» / «Exportar esta vista», pasando filtros admitidos. Comparar importes y filas. |
| A05 | P2 · Observado en prueba ficticia y código | Lanzador fijo de chat (`src/components/guafra-chat.module.css`) puede quedar sobre mensajes de confirmación o cifras al desplazarse en móvil. | Oculta información en una zona pequeña aunque la página no desborde. | Lanzador más discreto o espacio reservado; revisar teclado, barra inferior y avisos en 320/390/430 px. No quitar el acceso al soporte. |
| A06 | P2 · Observado con datos ficticios y confirmado en código | `src/server/guafra-chat.ts:chatCases` limita a 20 por origen; el historial no ofrece paginación para los anteriores. El código permite abrir un caso conocido. | Una consulta antigua puede no aparecer aunque siga guardada; buscarla exige conocer el código o enlace. | Paginación/cursor, búsqueda y etiquetas «Con Guafra», «Con el equipo», «Formulario». Probar más de 20 por canal y fechas iguales. |
| A07 | P2 · Confirmado en código | `src/app/app/inversiones/ticker-input.tsx:20–27`: fallo de red o respuesta no exitosa deja resultados vacíos; no explica si no encontró símbolos o falló el servicio. | Parece que la especie no existe. | Mensaje de conexión/error y reintento; distinguir abortar una búsqueda al escribir de un fallo real. Probar offline, timeout, HTTP 429 y cero resultados. |
| A08 | P2 · Riesgo confirmado por validación de código; no provocado en producción | Calendario, Movimientos y Reporte aceptan meses mediante `\d{4}-\d{2}`, sin restringir 01–12; luego construyen fechas. | Un enlace inválido puede producir error en lugar de recuperarse. | Validador común con rango y estado de error útil. Probar 00, 13, 99 y fechas válidas. Presupuestos ya restringe el mes en su propuesta. |
| A09 | P2 · Confirmado en código | `src/app/app/objetivos/page.tsx` ofrece «Sumar un aporte»; `src/server/planning.ts:addContribution` registra una contribución sin mover dinero entre cuentas. | Puede interpretarse como dinero realmente apartado cuando solo se actualizó el seguimiento. | Explicar «Registrar ahorro ya separado». Si se quiere transferencia real, diseñarla como acción distinta con cuenta origen/destino y sin duplicación. |
| A10 | P2 · Confirmado en código | Simulador usa formularios GET (`src/app/app/simulador/page.tsx:40,120`) con importes en la URL. | Valores quedan en historial y enlaces copiados. No se comprobó exposición a terceros. | Evaluar cálculo sin importes en URL o guardado privado con identificador; revisar qué registran analítica y logs. Probar compartir y volver atrás. |
| A11 | P2 · Confirmado en código | Importaciones: `src/app/app/importar/page.tsx:20` carga solo los últimos 20 lotes, sin paginación para el historial completo. | Con uso prolongado cuesta localizar un lote anterior para revisar o deshacer. | Historial paginado con estado y fecha. Probar 21 lotes y anulación autorizada solo en datos ficticios. |
| A12 | P2 · Mejora de claridad | Inicio calcula disponible descontando pendientes cargados; Flujo agrega recurrentes y estimaciones según vista. El enlace «A fin de mes terminás con» lleva a una cifra con otro alcance. Evidencia: `src/app/app/page.tsx`, `src/server/forecast.ts`, `src/app/app/flujo/page.tsx`. | Puede parecer contradicción aunque sean cálculos distintos. | Nombrar «Con pagos cargados» y «Proyección con estimaciones», mostrar alcance junto a la cifra. La propuesta de Presupuestos solo añade una aclaración, no cambia el cálculo del Inicio. |

## Recomendaciones por área

| Área | Mantener / mejorar | Cómo comprobarlo |
| --- | --- | --- |
| Inicio | Priorizar disponible, próximos vencimientos y una acción principal. Explicar alcance sin textos extensos. | Persona nueva identifica qué registrar primero y qué significa el disponible. |
| Movimientos | Diferenciar fecha del pago y mes del gasto; edición y eliminación con consecuencias claras. Mejorar el acceso al filtro por categoría sin depender de búsqueda textual. | Pago tardío, reintegro, transferencia y búsqueda de una compra sin duplicarla. |
| Cuentas | Resolver A02; conciliación siempre debe explicar que corrige el registro y no hace una transferencia bancaria. | Saldos y totales exactos con lista larga; ajuste identificable. |
| Revisión del mes | Conservar los cuatro pasos; añadir avance y acceso contextual a lo pendiente. | Completar revisión sin necesitar saber qué módulo interno usar. |
| Próximos pagos y cobros | Conservar búsqueda, orden alfabético y coincidencias; llamar «Posibles duplicados» y nunca borrarlos automáticamente. Diferenciar previsto, parcial, vencido y estimado. | Dos cuotas legítimas iguales no se eliminan como error; pago parcial conserva remanente. |
| Recurrentes | Nombre e importe primero; «Cambiar desde una fecha», «Pausar», «Terminar» y «Eliminar» con consecuencias separadas. | Cambio futuro conserva lo ya pagado y no genera dos ocurrencias. |
| Calendario | Lista del día accesible y estados diferenciados sin depender solo del color; resolver A08. | Navegar mes/día por teclado y celular; comprobar paridad con próximos pagos. |
| Tarjetas | Mantener modos simple/detallado, pero explicar antes de elegir que no deben superponerse. Hacer visibles cierre, vencimiento y saldo pendiente del resumen. | Compra, cuota, devolución y pago de resumen sin doble gasto. No se probaron operaciones reales en esta revisión. |
| Deudas | Resolver A01; distinguir capital pendiente de total de cuotas e intereses. | Monedas separadas, refinanciación y cancelación anticipada con resumen previo. |
| Presupuestos | Implementación autorizada: cálculo consistente, desglose, detalle, copia con feedback y ayuda relacionada. | Pruebas y recorrido ficticio documentados aparte. |
| Objetivos | Resolver ambigüedad A09; distinguir registrar ahorro de transferir dinero. | Usuario explica dónde está el dinero y qué cambió al sumar aporte. |
| Flujo | Diferenciar confirmado/estimado; mostrar por qué un mes cambia al editar un presupuesto o recurrente. Evitar presentar 5 años como pronóstico exacto. | Total del detalle concilia con cada mes, filtro confirmado excluye estimaciones. |
| Simulador | Resolver A10; resumir supuestos y avisar si faltan ingresos/gastos. La simulación no garantiza capacidad de pago. | Compra y préstamo ficticios, cuotas e interés, sin escribir movimientos. |
| Inversiones | Resolver A07; mostrar fuente, fecha, moneda y si el valor es manual o actualizado. | API caída no parece cero patrimonio; cotización vencida visible. |
| Patrimonio y bienes | Mantener monedas sin cotización separadas; explicar valuación manual y alcance de «neto». | No sumar monedas sin convertir; una valuación no cambia caja. |
| Cereal | Diferenciar venta real, cobro pendiente, stock y estimación mensual; unidades siempre visibles. | Quintal/tonelada, venta parcial y stock sin doble proyección. Solo lectura de pantalla en esta fase. |
| Informes y PDF | Resolver A03/A04; explicar mes económico frente a fecha efectiva. | Misma base de cálculo y filtros produce mismos totales. |
| Alertas | Agrupar «Requiere acción», «Para revisar», «Información» y enlazar al registro específico. No etiquetar previsión como gasto consumado. | Menos alertas repetidas y acción identificable. Las alertas de presupuesto se corrigen dentro del alcance autorizado. |
| Categorías | Jerarquía clara, buscador y aviso sobre mover o archivar categorías usadas. | Cambiar categoría conserva importes; presupuesto principal incluye subcategorías. |
| Importar/exportar | Resolver A11; conservar vista previa y deshacer por lote. Mostrar filas importadas/omitidas/duplicadas. | Importar dos veces y revisar antes de guardar; probar solo con archivos ficticios. |
| Plan y pagos | Conservar distinción trial, pendiente y pago activo; historial y siguiente acción simples. No añadir pantallas que inicien otra contratación si existe una válida. | Pruebas automáticas existentes; ciclo externo real/sandbox pendiente de decisión del usuario. |
| Seguridad y datos | Mantener segundo factor y sesiones; resumir consecuencias de cerrar sesiones, salir de espacio o borrar cuenta como acciones distintas. | Permisos desde servidor y aislamiento con cuentas ficticias; no se modificó seguridad real. |
| Compartir y funciones | Dejar visible espacio activo y rol; distinguir ocultar un módulo de borrar datos. | Invitado de lectura no puede ejecutar mutaciones; downgrade conserva datos. |
| Ayuda y chat | Ayuda contextual corta con ejemplo y enlace a la pantalla; bot debe guiar y derivar, sin confirmar pagos ni resolver reclamos delicados automáticamente. Resolver A05/A06. | Preguntas ambiguas, falta de conexión, historial y volver a Inicio. |

## Gestión del soporte recomendada, pendiente de decisión

Mantener el mismo código e historial cuando se deriva al equipo. Mostrar responsable, último mensaje, estado, prioridad y vencimiento de atención. Cerrar el widget no cierra el caso. Tras respuesta humana, «Esperando al cliente»; si el equipo investiga, «En revisión interna».

No activar un cierre automático uniforme para pagos, privacidad o reclamos. Para consultas generales puede proponerse recordatorio y cierre tras varios días de silencio, con plazo explícito, historial conservado y reapertura cuando el cliente responda. Falta elegir esa política; no se implementó.

Las respuestas guardadas deben insertarse como borrador revisable; nunca enviarse solas. Correo de aviso con enlace al chat, recepción por correo desactivada según decisión del usuario.

## Orden para aprobar correcciones

1. A01, A02 y A03: exactitud de cifras. No requieren modificar datos financieros existentes.
2. A04–A08 y A11: coherencia entre pantallas, historial y recuperación de errores.
3. A09, A10 y A12: aclaraciones de producto y privacidad de navegación; acordar el comportamiento antes de implementar.
4. Evolutivos por área: aplicar de a grupos pequeños, con pruebas de regresión y revisión móvil. Evitar rediseñar todo simultáneamente.

No se corrigió ninguno de A01–A12 fuera de las aclaraciones y cálculos expresamente incluidos en Presupuestos. No se desplegaron estos hallazgos ni se tocaron registros reales.
