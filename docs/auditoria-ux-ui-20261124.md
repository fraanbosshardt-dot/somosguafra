# Revisión visual y funcional de Guafra — 24/11/2026

## Alcance y límites

Auditoría sin cambios de implementación. Código de referencia: `731566d628fedb52f6cb6705cfda0cf0a4af6ae2`. Navegación real de producción en Brave, con sesión iniciada; escritorio de aproximadamente 1920 × 1080 y emulación móvil de 440 × 956 y 375 × 667. La emulación no equivale a probar Safari, teclado virtual o un dispositivo físico.

La cuenta disponible figura Gratis y tiene una solicitud mensual pendiente. No se activaron trials, no se inició checkout, no se registraron movimientos, no se guardaron formularios, no se enviaron consultas, no se cambiaron permisos ni se ejecutaron bajas. Se abrieron formularios, ediciones, selectores y conversaciones existentes. Las guías pueden recordar localmente su primera visualización al visitar las pantallas, como parte de su funcionamiento normal.

No todas las áreas tienen datos en esta cuenta. El interior Pro de Informes, Agro, costos, traslado, compartir y escenarios sigue pendiente con una cuenta habilitada o datos ficticios. También faltan los detalles con registros de tarjetas, deudas, objetivos e inversiones, las validaciones de guardado en una base de prueba, otras resoluciones, zoom y navegación completa por teclado. Se solicitó acceso Pro durante la revisión; no se cambió el plan para obtenerlo.

No se presenta esta revisión como una auditoría exhaustiva de seguridad, de pagos o una certificación de ausencia de errores. No se midieron Core Web Vitals ni tiempos de red. No se ejecutaron ataques ni pruebas de carga.

## Resultado principal

En las vistas efectivamente recorridas no se reprodujo una superposición grave de textos o botones. Sí se observaron problemas de jerarquía, navegación y exceso de desplazamiento, además de inconsistencias funcionales concretas. Las guías insertadas dentro del encabezado elevan la altura de la página y centran las acciones, como el selector del mes, contra toda la altura del recorrido. En celular, explicaciones y controles previos dejan la tarea principal demasiado abajo.

El objetivo recomendado es ordenar lo que existe, sin agregar inicialmente nuevas funciones ni modificar cálculos financieros. Una acción principal por pantalla; filtros en un bloque; ayuda separada de la barra de acciones; herramientas avanzadas bajo una entrada secundaria; avisos comerciales según acceso real.

## Inventario de la revisión real

| Pantalla/ruta | Qué se revisó | Resultado/límite |
| --- | --- | --- |
| `/app` | Resumen inicial, explicación desplegada, accesos | Sin solapamiento observado; mejorar diferencia entre cobro próximo y total por cobrar. |
| `/app/movimientos` | Lista y filtros; apertura de Desde/Hasta | Correcto al desplegar en escritorio; demasiadas filas antes de la lista. |
| `/app/movimientos/nuevo` | Guía, Más opciones, división sin guardar; escritorio y 375 px | Campos accesibles; recorrido largo. No se probaron escrituras. |
| `/app/movimientos/preferencias` | Vista sin favoritos y acceso a reglas | Guía desplaza la tarea; formulario de primer favorito escondido aunque la lista está vacía. |
| `/app/cuentas` | Lista, Nueva cuenta desplegada | Sin texto pisado; formulario usa parte de una tarjeta mucho más ancha. |
| `/app/cuentas/[id]` | Cuenta existente, movimientos y Editar desplegado | Sin superposición observada. No se ajustó saldo ni desactivó cuenta. |
| `/app/revision` | Controles y siguiente paso | El enlace del siguiente paso no conduce a la tarea anunciada; pluralización y conteo a revisar. |
| `/app/proximos` | Lista, filtros, mes desplegado; escritorio y 375 px | Filas móviles legibles; filtros siempre abiertos retrasan mucho el acceso a los vencimientos. |
| `/app/calendario` | Mes actual con eventos y leyenda | Vista de escritorio sin solapamiento observado. No se registró ningún pago. |
| `/app/tarjetas` | Alta vacía, Más detalles desplegado | Sin superposición; no hay tarjetas existentes para probar compra/resumen. |
| `/app/deudas` | Alta vacía y Más detalles desplegado | Formulario avanzado muy largo; no se subieron contratos ni guardó deuda. |
| `/app/objetivos` | Alta vacía | Sin superposición; edición y aportes requieren datos ficticios o un objetivo existente. |
| `/app/flujo` | Resumen, tabla y detalle inferior, gate día a día | Legible en escritorio; selección de detalle puede quedar lejos del enlace del mes. Interior largo Pro no disponible. |
| `/app/simulador` | Calculadora inicial y acceso a escenarios | Campo de financiación estrecho; no se ejecutó simulación ni accedió a escenarios Pro. |
| `/app/presupuestos` | Sin presupuesto, guía, categoría agregada al borrador sin guardar, selector; 1920/440/375 px | Problema de jerarquía reproducido. En 375 px se necesitan varios desplazamientos para crear el presupuesto. |
| `/app/presupuestos/trasladar` | Gate Gratis y guía | Guía operativa se muestra pese a no tener acceso. No se confirmó traslado. |
| `/app/resumen` | Resumen con movimientos, filtros y categorías | Guía y acción de revisar datos compiten; mismo problema de encabezado. |
| `/app/recurrentes` | Dos reglas existentes; edición desplegada y acciones inferiores | Edición excesivamente larga dentro de la lista; no se guardó, pausó o borró nada. |
| `/app/recurrentes/costos` | Gate y guía | Guía previa a una función bloqueada; interior Pro pendiente. |
| `/app/patrimonio` | Resumen con cuenta y conversión | Mostrar fuente/fecha de conversión junto al equivalente sería más claro. No se confirmó vigencia de cotizaciones. |
| `/app/inversiones` | Alta vacía | Sin superposición observada; valoración con posiciones reales/ficticias pendiente. |
| `/app/importar` | Guía, archivo/cuenta y exportación | Guía por encima de navegación de ajustes. No se seleccionó/importó un archivo en producción. |
| `/app/informes` y `/app/cereal` | Presentación bloqueada para Gratis | Se ofrece trial pese a existir una solicitud pendiente; interior pendiente. |
| `/app/categorias` | Lista y Editar desplegado | Una edición alarga toda la fila visual; no se guardó ni borró categoría. |
| `/app/configuracion` | General, Funciones, Compartir, Seguridad, Plan, Tus datos | Tus datos queda fuera de la barra visible en escritorio. Selector móvil permite llegar correctamente. |
| `/app/alertas` | Consejos, acciones y explicación de posponer | Controles separados; no se pospusieron avisos ni se ocultaron problemas. |
| `/app/ayuda` | FAQ, temas, acceso a soporte | 50 respuestas en una lista; las novedades ocupan los primeros puestos antes de tareas básicas. |
| Chat | Inicio, historial, caso anterior, derivación sin registrar, cierre y reapertura; escritorio/móvil | Inicio e historial separados. Formulario de derivación sin conversación detrás. Cruz centrada. Envío y teclado físico pendientes. |
| Landing `/` y `/#planes` | Hero con sesión, planes, cambio a anual y navegación a Mi plan | Se pierde selección anual en la solicitud pendiente. Enlace secundario duplicado y oscuro sobre tarjeta oscura. |

La revisión no incluye todas las páginas públicas legales ni todas las pantallas del panel administrativo. El panel apareció al seleccionar la ventana, pero no se auditó su funcionamiento en este recorrido. No confundir inventario de rutas con pruebas completas de todas sus variantes.

## Hallazgos priorizados

P1 = fricción o error funcional relevante. P2 = claridad, consistencia y accesibilidad visual. P3 = evolución. No se identificó un P0 mediante este recorrido; eso no descarta problemas fuera de su alcance.

| ID | Prioridad / evidencia | Problema y efecto | Propuesta | Validación |
| --- | --- | --- | --- | --- |
| UX-01 | P1 · Producción + `src/components/page.tsx:12`, `src/app/globals.css:102` | `ProductGuide` está dentro del bloque izquierdo de un encabezado flex centrado. Al abrirse, el mes/acción se alinea con el centro de la guía y pierde relación con el título. Reproducido en Presupuestos, Resumen y Favoritos. | Encabezado fijo de título/acciones; guía como bloque independiente o panel de ayuda. Nunca dentro de la altura que posiciona el selector del mes. | Abrir/cerrar todos los pasos sin desplazar la barra de acciones respecto del título; 375/768/1280/1920 px. |
| UX-02 | P1 · Producción 375 px + `src/app/app/presupuestos/page.tsx:43` y `:86` | Guía, explicación general, estado vacío, copiar, traslado y explicación de cálculo aparecen antes del editor. La tarea central queda demasiado abajo. | Mes bajo el título; crear/editar presupuesto como acción principal; herramientas del mes en menú secundario; ayuda bajo demanda. | Sin presupuesto: encontrar Agregar categoría sin atravesar bloques avanzados. Con presupuesto: ver resumen y categorías primero. |
| UX-03 | P1 · Producción + `src/components/pro.tsx:10`, `src/components/product-guide.tsx:58` | La guía se decide solo por ruta y también se abre en la pantalla bloqueada de costos/traslado. Enseña pasos que Gratis no puede realizar. | Pasar acceso efectivo desde servidor y omitir guía operativa en gates; explicación comercial breve separada. | Gratis no inicia recorrido imposible; Pro sí dispone de guía y función. Rol lector recibe instrucciones acordes a sus permisos. |
| UX-04 | P1 · Reproducido de punta a punta en navegación + `src/components/app-cta.tsx:58`, `src/app/app/configuracion/page.tsx:202` | Con solicitud mensual pendiente, seleccionar anual en landing termina en `/app/configuracion?tab=plan` y Mi plan vuelve a mensual. `SubscribeCta` descarta `cycle` al devolver Ver mi plan. | Preservar el ciclo elegido al entrar a Mi plan (`ciclo=anual`), sin crear otro acuerdo. Reutilizar pendiente del mismo ciclo; si se cambia, mantener la confirmación actual de reemplazo. | Matriz mensual/anual × pendiente mensual/anual × trial/pago activo. Verificar navegación y ausencia de nuevas solicitudes hasta confirmar. No probar cobrando. |
| UX-05 | P1 · Producción + `src/app/globals.css:300`, `src/components/page.tsx:55` | Configuración estrecha muestra hasta Plan; Tus datos queda fuera y la barra oculta su scrollbar. Incluso entrando directamente, el texto activo queda fuera de vista. | Navegación agrupada de ajustes, selector visible también en anchos intermedios o indicación clara de desplazamiento; llevar la sección activa a la vista. | Todas las secciones localizables en 900–1280 px; pestaña activa visible con teclado y enlace directo. |
| UX-06 | P1 · Oferta visible + incompatibilidad confirmada en código: `src/components/pro.tsx:15`, `src/server/plans.ts:20` | Gates ofrecen Probar gratis según `trialUsed`, aunque una solicitud pendiente impide `startFreeTrial`. Mi plan sí conoce esa restricción. No se pulsó el trial. | Usar una única elegibilidad de trial basada en estado real y rol. Si no procede, mostrar Gestionar mi plan, sin ofrecer una acción que será rechazada. | Pendiente, trial usado, lector, suspendido y usuario elegible: CTA coincide con lo que acepta el servidor. |
| UX-07 | P2 · Producción + `src/app/app/presupuestos/page.tsx:86`, `src/app/app/recurrentes/page.tsx:104`, `src/app/app/movimientos/preferencias/page.tsx:25` | Etiquetas Pro aparecen sin consultar el acceso efectivo de esas entradas. Para Pro se sienten publicitarias y redundantes; para Gratis no describen claramente el bloqueo. | Con acceso: nombre normal y acción utilizable. Sin acceso: candado discreto + Pro, con descripción y vista de planes. Mantener la función visible para quien ya la tiene. | Revisar Gratis, trial, Pro pago y Pro otorgado; nunca ocultar una función contratada por quitar la etiqueta comercial. |
| UX-08 | P2 · Producción + `src/app/app/revision/page.tsx:25` | Tu próximo paso anuncia revisar un saldo, pero el único enlace lleva al resumen mensual. Exige volver a buscar la tarea. | CTA dinámico a la primera tarea pendiente; resumen como enlace secundario. | Sin cuentas → crear; saldo sin revisar → cuenta; atrasos → filtro de atrasados; sin categoría → movimientos filtrados. |
| UX-09 | P2 · Confirmado por inspección, no reproducido con registros terminados: `src/app/app/revision/page.tsx:16` | Conteo de recurrentes solo filtra `pausedAt`, incluye reglas terminadas. `recurrentes/page.tsx:33` usa otro criterio para activas. Además muestra 1 ingresos / 1 gastos. | Compartir criterio de regla vigente e implementar pluralización. | Base ficticia con activa, pausada, finalizada y reemplazada; el conteo coincide con la lista vigente. |
| UX-10 | P2 · Producción + `src/app/landing.css:141`, `src/app/landing.css:156`, `src/app/site.css:5` | En tarjeta Pro oscura, enlace alternativo mensual y Ver condiciones usan verde oscuro. El alternativo y el CTA principal pueden mostrar el mismo Ver mi plan. | Color semántico para enlaces sobre fondo oscuro; una acción principal y alternativa solo si tiene destino/propósito distinto. | Contraste y estados hover/foco en ambos temas, con y sin sesión. Colores fuente de referencia dan aproximadamente 1,77:1 para `#16493A` sobre `#0B1813`; no es una medición de píxeles ni certificación WCAG. |
| UX-11 | P2 · Producción móvil + `src/app/app/proximos/page.tsx:89` | Filtros abiertos ocupan casi otra pantalla antes de los meses. Limpiar queda en una fila muy alta y las filas financieras aparecen tarde. | Búsqueda visible; Ordenar/Posibles repetidos bajo Filtros con contador de filtros activos. Aplicar/Limpiar en fila compartida cuando quepan. | Usuario encuentra el próximo vencimiento con poco desplazamiento; filtros activos siempre reconocibles, sin perder A–Z ni revisión de repetidos. |
| UX-12 | P2 · Producción + `src/app/app/recurrentes/page.tsx:54`, `src/app/app/categorias/page.tsx` | Edición expandida vuelve muy largas las listas y desplaza registros vecinos; en categorías deja grandes huecos en las otras columnas. | Editor separado en panel/drawer accesible o pantalla dedicada, con guardar/cancelar claros. Acciones destructivas en un bloque secundario. | Abrir/cerrar sin perder búsqueda, posición ni borrador. Probar teclado y retorno del foco. |
| UX-13 | P2 · Producción + `src/components/help-faq.tsx:21`, `src/app/app/ayuda/page.tsx:21` | FAQ conserva 50 respuestas en una lista; novedades y herramientas Pro desplazan preguntas básicas. En móvil, ayuda rápida consume bastante espacio. | Agrupar por tarea y mostrar primero Comenzar, Cargar dinero, Planificar y Pagos/soporte. Mantener búsqueda y acceso a todas las respuestas. | Encontrar cómo crear cuenta/presupuesto, corregir un gasto y consultar un pago sin recorrer 50 entradas. |
| UX-14 | P2 · Producción + `src/components/plan-subscription-card.tsx:36` | Con solicitud existente, CTA Elegir Pro no comunica que se retomará/revisará la operación. El backend tiene estado específico de pendiente. | Etiqueta según contexto dentro de Mi plan; resumir ciclo/estado junto al botón. No volver a poner mensajes operativos en la landing. | El mismo ciclo indica retomar; otro ciclo indica revisar cambio; un pago activo no invita a pagar de nuevo. |
| UX-15 | P2 · Producción + `src/app/app/movimientos/preferencias/page.tsx:23` | Lista vacía de favoritos deja el formulario escondido bajo Agregar o actualizar un favorito. El usuario nuevo no sabe qué actualizar. | Estado vacío con ejemplo y Crear mi primer favorito. Si ya hay favoritos, Agregar favorito y edición explícita por fila. | Primera carga entendible, sin abrir ayudas adicionales y sin generar movimientos al crear un favorito. |

## Propuesta concreta para Presupuestos

1. **Encabezado:** Presupuestos y una descripción de una línea. Mes en una barra propia estable, con anterior/siguiente. Ayuda como botón secundario alineado, sin competir con el mes.
2. **Si todavía no hay presupuesto:** tarjeta corta Crear presupuesto del mes, seguida inmediatamente del selector de categorías y límites. Copiar el mes anterior como alternativa secundaria. No presentar antes el traslado Pro ni varias explicaciones de cálculo.
3. **Si ya existe:** resumen compacto (límite, gastado, previsto y margen) y categorías con barra de consumo. Editar límites visible. Diferenciar barra de gastado y previsto con leyenda; no depender solo del color.
4. **Opciones del mes:** Copiar límites y, para acceso habilitado, Copiar y sumar margen. Abrir este último en su revisión actual; no ejecutar automáticamente. Explicar que el margen aumenta el límite, no el dinero de las cuentas.
5. **Pro:** si ya está habilitado, mostrar la función normalmente, sin candado ni venta. Si no está habilitado, una entrada discreta con Pro y vista explicativa. Nunca esconder la función para quien la contrató.
6. **Ayuda:** invitación de una línea en el primer uso y recorrido opcional; al abrirlo, usar bloque independiente del encabezado. En pantallas con datos vacíos, priorizar hacer antes que leer. El recorrido actual sigue disponible para reabrirlo.
7. **Textos:** unificar Previsto en las tarjetas y explicar una vez que reúne pendiente y programado. Gastado sigue siendo lo registrado; margen sigue siendo distinto del saldo bancario. No cambiar fórmulas como parte de una mejora de diseño.

Ejemplo de jerarquía, no maqueta implementada:

```text
Presupuestos                          Ayuda
       ‹  Noviembre 2026  ›

Límite · Gastado · Previsto · Margen

Mis categorías                     Editar límites
Alimentación       [barra]         Ver detalle
Servicios          [barra]         Ver detalle

Opciones del mes ▾
Cómo se calcula ▾
```

## Mejoras por área y funciones futuras

| Área | Mejorar primero | Evolución posterior propuesta, no implementada |
| --- | --- | --- |
| Inicio | Separar mejor próximo cobro de total por cobrar; conservar acceso rápido a carga | Checklist contextual de datos faltantes, sin asegurar que las finanzas están completas. |
| Movimientos | Unificar filtros y distinguir con claridad fecha de pago y mes económico | Vistas de filtros guardadas; clasificación en lote con vista previa y reversión. |
| Próximos / Calendario | Filtros compactos; acciones con nombres accesibles; mantener fechas y A–Z | Una bandeja de revisión de coincidencias, sin borrado automático de registros parecidos. |
| Cuentas / Revisión | Ir directamente a la tarea pendiente; conciliación más fácil de encontrar | Historial de revisiones y diferencias antes/después. |
| Presupuestos | Jerarquía propuesta; conservar cálculo real/previsto/estimado | Plantilla mensual explícita, optativa, sin duplicar límites ni gastos. |
| Tarjetas / Deudas | Separar carga básica y avanzada; evitar prometer completar todo desde cualquier PDF | Vista previa de cambios de cronograma antes de guardarlos. |
| Objetivos | Mostrar claramente ahorro registrado frente a aporte estimado; revisar edición con datos | Aportes sugeridos por capacidad de ahorro, claramente estimados. |
| Flujo / Simulador | Detalle del mes junto a la selección; escenarios y supuestos más visibles | Comparar dos escenarios guardados y explicar qué variable produjo la diferencia. Revisar primero lo que ya existe para no duplicarlo. |
| Inversiones / Patrimonio | Fecha, fuente y moneda de cada valoración/conversión más visibles | Indicador de cotizaciones desactualizadas y cobertura, sin recomendaciones de inversión. |
| Importar | Revisar antes de guardar; evitar que ayuda y ajustes desplacen archivo/cuenta | Plantillas de columnas por archivo/banco, con confirmación y protección contra duplicados. |
| Ayuda / Chat | Orden por tarea, ayuda sensible al plan, historial con asunto prioritario | Vincular una consulta a la pantalla de origen sin adjuntar finanzas personales automáticamente. |

Gratis debe ser fácil para registrar, revisar y entender. Pro puede ahorrar carga manual y ayudar a anticiparse. No recomiendo sumar más opciones hasta corregir jerarquía, navegación y pruebas con datos de ambos planes.

## Orden recomendado de implementación, sujeto a aprobación

1. **Pase funcional acotado:** conservar ciclo anual; coherencia de elegibilidad de trial; guías acordes al acceso; siguiente paso útil y conteo de recurrentes correcto. Tests de estados y navegación con base ficticia.
2. **Presupuestos piloto:** nueva jerarquía, guía desacoplada y opciones avanzadas secundarias. Revisar vacíos y presupuestos con datos en móvil/escritorio antes de extender el patrón.
3. **Patrón común:** navegación de ajustes, filtros, edición y badges. Aplicarlo por áreas, sin una reescritura general del CSS ni cambiar cálculos.
4. **Textos y soporte:** actualizar Ayuda y respuestas compartidas del bot a la interfaz final aprobada. Modificar legales solo si cambian realmente tratamientos o condiciones; una corrección estética no necesita inventar cambios legales.
5. **Regresión:** Gratis/trial/Pro, dueño/editor/lector, datos vacíos y extensos, importes largos, 320/375/440/768/1280/1920 px, zoom 200 %, teclado, contraste, teclado virtual físico, retorno del foco y red lenta/error.

No se incluye despliegue ni aprobación implícita para ejecutar cobros. Esta entrega es únicamente diagnóstico y propuesta.
