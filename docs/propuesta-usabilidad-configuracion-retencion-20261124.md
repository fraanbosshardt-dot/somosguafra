# Revisión real de uso y propuesta de organización

Fecha: 24 de noviembre de 2026. Base revisada: `f789854b8409fecf7e08f53c2284595c2701638a`.

## Alcance y límites

Se recorrió la aplicación publicada con sesión autenticada, acceso Pro de prueba y una solicitud anual pendiente; también las vistas administrativas disponibles. Se abrieron formularios, filtros, detalles y desplegables sin guardar operaciones financieras, contratar, cancelar, responder casos ni enviar correos. Se contrastó el comportamiento con el código. Las capturas privadas permanecen fuera del repositorio, en `.data/ux-real-20261124/`.

La revisión cubre escritorio y una selección representativa móvil de 375 × 667. No equivale a probar todas las combinaciones de datos, permisos, estados de pago o dispositivos físicos. La cuenta no tiene tarjetas ni deudas registradas: se inspeccionaron sus formularios, no un ciclo completo con datos reales. No se importaron archivos ni se probaron pagos reales. Los correos descritos se verificaron en código, no mediante entregas durante esta revisión.

Los cambios de meses, buscadores y carga inicial de chat ya se publicaron en PR #21. Esta propuesta adicional no modifica el sistema ni activa campañas o vencimientos.

## Respuestas inmediatas

### La tarjeta de configuración inicial

Ya se oculta cuando los cuatro pasos están completos: `src/app/app/page.tsx:162` solo la renderiza si `stepsLeft > 0`. El segundo paso cuenta reglas de ingreso recurrente (`direction: RECEIVABLE`), no ingresos aislados de Movimientos (`page.tsx:35–50`).

Hay una inconsistencia confirmada: el enlace de ese paso abre `/app/recurrentes?nueva=1`, pero el formulario comienza seleccionado como **Gasto (pago)** (`src/app/app/recurrentes/page.tsx:116`). Esto facilita registrar un sueldo recibido como salida. En la cuenta revisada, un concepto llamado Sueldo figura como pago. Su nombre no permite decidir por sí solo si está mal: podría ser un sueldo que se paga a otra persona. No se cambió ese registro.

Propuesta: acceso de ingresos con tipo Ingreso preseleccionado, texto «Programá un ingreso habitual», explicación de ingreso registrado frente a ingreso esperado y alternativa «Mis ingresos son variables / No lo necesito por ahora». No obligar a crear una recurrencia ficticia para ocultar la tarjeta. Al completar u omitir explícitamente los pasos, ocultarla y conservar la guía en Ayuda. Antes de tocar datos existentes, confirmar su significado y mostrar el efecto futuro.

### Configuración cambia de distribución

Confirmado en producción y código: General, Plan y Tus datos usan un contenedor de ancho distinto al de Categorías, Recurrentes e Importar. Los nueve enlaces se distribuyen con salto de línea y cambian de fila según el ancho disponible. Evidencia: `src/app/app/configuracion/page.tsx:230`, `src/components/settings-navigation.tsx`, estilos de `.settings-sections` y `.narrow.wide` en `src/app/globals.css`.

### Mi plan mezcla dos ciclos visibles

Confirmado: hay una solicitud anual pendiente, pero al entrar sin `ciclo=anual` el selector empieza mensual. `configuracion/page.tsx:202` deriva `annual` únicamente del parámetro de URL; `src/components/plan-subscription-card.tsx` aplica ese booleano a los radios. El backend conserva controles de reutilización/reemplazo: esto es una incoherencia visual, no evidencia de un cobro duplicado.

Propuesta: prioridad del ciclo explícitamente seleccionado para contratar; en la vista de gestión, ciclo de la solicitud existente. Mostrar «Continuar solicitud anual» y separar «Cambiar ciclo» con confirmación del reemplazo. Trial, cobertura paga y solicitud incompleta deben ser bloques distintos.

## Hallazgos y prioridades

| ID | Tipo | Prioridad | Evidencia | Cambio propuesto | Validación |
| --- | --- | --- | --- | --- | --- |
| UX-01 | Error confirmado | P1 | Inicio → ingreso recurrente abre tipo Gasto; archivos citados arriba | Preselección explícita e instrucciones de ingreso esperado | Acceso desde Inicio abre Ingreso; gasto abre Gasto; guardar cada uno afecta el lado correcto de la proyección |
| UX-02 | Error confirmado | P1 | Solicitud anual y selector mensual; PlanSubscriptionCard | Ciclo coherente con la solicitud y reemplazo explícito | Trial + pendiente anual/mensual, URL con/sin ciclo, doble pestaña; ninguna segunda operación involuntaria |
| UX-03 | Diseño confirmado | P2 | Ancho y saltos de navegación de Configuración | Estructura común y subsecciones estables | Todas las rutas mantienen ubicación, ancho y sección activa en 320/375/768/1280 px |
| UX-04 | Limitación confirmada | P1 | Edición de reglas en recurrentes: importe, día y vigencia; no corrige dirección/concepto/cuenta | Edición controlada de datos de la regla y vista previa de futuras ocurrencias | No alterar movimientos pagados ni historial; confirmar efectos futuros y evitar duplicados |
| UX-05 | Mejora de uso | P2 | Objetivos: Editar y Registrar ahorro abiertos generan una tarjeta larga con varias acciones de guardar | Un editor activo a la vez; aporte previsto separado de ahorro registrado | Abrir/cerrar conserva borrador; título y acción identifican qué se guarda |
| UX-06 | Accesibilidad confirmada en código | P2 | `src/app/app/movimientos/nuevo/movement-form.tsx`: selección mediante clase `on` en botones de tipo/estado | Semántica de selección con radios o `aria-pressed` | Teclado y lector anuncian Gasto/Ingreso/Transferencia y estado seleccionado |
| UX-07 | Mejora de jerarquía | P2 | General presenta tema/tamaño antes de perfil; muchas monedas visibles | Perfil primero, preferencias después, otras monedas progresivas | Se encuentra nombre/moneda principal sin recorrer opciones secundarias |
| UX-08 | Mejora de claridad | P2 | Mi plan móvil: mucho texto previo a la acción y referidos junto a gestión | Resumen breve, estado y próxima acción; condiciones ampliables; referidos secundarios | El usuario identifica acceso, ciclo, importe y acción sin interpretar varios párrafos |
| UX-09 | Mejora de texto | P2 | Simulador: «Es…», «colchón», campos de financiación | Nombres completos y campos dependientes de modalidad | Se distingue compra/préstamo/escenario y qué datos faltan antes de calcular |
| UX-10 | Riesgo de expectativa | P2 | Formulario de préstamo desde PDF promete completar datos | Mensaje de extracción tentativa y revisión previa | Archivo ilegible no crea deuda; datos extraídos siempre se revisan |
| UX-11 | Mejora contextual | P2 | Chat dentro de la app conserva temas principalmente comerciales | Temas según página; «Pago de Pro» separado de finanzas personales | Ayuda contextual no modifica saldos ni crea otro caso al retomarlo |
| OPS-01 | Política pendiente | P1 | `src/server/billing.ts`: recuperación/reconciliación existentes, sin vencimiento por antigüedad encontrado | Clasificar abandono y después evaluar cierre seguro | Ver matriz de intentos; jamás cancelar un autorizado por estar desactualizado localmente |
| MAIL-01 | Capacidad pendiente | P2 | Comunicaciones declara ausencia de campañas; no se encontró consentimiento/promociones completo en modelo | Preferencias, consentimiento, baja, supresiones y trazabilidad antes de automatizar | No opt-in → cero marketing; baja inmediata; servicio sigue separado |

No se confirmó un solapamiento general de textos en las vistas inspeccionadas. La falta de consistencia, formularios largos y jerarquía de acciones son problemas distintos de un desborde. En las vistas móviles comprobadas, el ancho del contenido principal no excedió su ancho disponible.

## Configuración propuesta

Mantener todas las funciones y URLs. Compartir un mismo contenedor y navegación entre rutas.

| Grupo | Orden y secciones | Información principal |
| --- | --- | --- |
| Tu cuenta | 1. Perfil y preferencias; 2. Seguridad; 3. Tus datos | Perfil, moneda, aspecto; acceso y sesiones; exportación y privacidad |
| Organizá tus finanzas | 4. Categorías; 5. Pagos y cobros que se repiten; 6. Importar y exportar; 7. Funciones | Organización del registro, automatismos y herramientas visibles |
| Plan y equipo | 8. Mi plan; 9. Compartir | Acceso y facturación separados de miembros y permisos |

Escritorio: navegación vertical de subsecciones y contenido a la derecha; no forzar nueve etiquetas extensas en una línea. Celular: selector agrupado estable y título de sección visible. Página inicial: Perfil y preferencias. Enlaces directos a Plan, Seguridad o Categorías siguen funcionando.

Sistema visual: conservar verde, fondos suaves, tipografía y logo actuales. Una acción principal por formulario; títulos junto a sus acciones; 6–8 px entre etiqueta y campo, 16–24 px entre campos y 24–32 px entre secciones, ajustados a los componentes existentes. Objetivos táctiles de aproximadamente 44 px y foco visible. Acciones peligrosas separadas de guardar. Campos avanzados a demanda, sin ocultar condiciones de dinero importantes. Estos valores son una propuesta de consistencia, no una medición de cada pantalla actual.

Se preparó una maqueta interactiva con datos ficticios para evaluar esta organización antes de implementarla. No cambia la aplicación.

## Revisión por área

| Área / rutas | Qué se inspeccionó | Mejora recomendada |
| --- | --- | --- |
| Inicio `/app` | Disponible, pendientes, checklist, accesos | Priorizar disponible; configuración breve y contextual; evitar instrucciones duplicadas |
| Movimientos `/app/movimientos`, nuevo y detalle | Mes, filtros, búsqueda, formulario y variantes disponibles | Tipo y estado inequívocos; fecha/cuenta accesibles; resumen previo a guardar |
| Cuentas y detalle | Alta, edición y corrección de saldo | Identidad de cuenta separada de ajuste; explicar que no transfiere dinero |
| Revisión del mes | Pasos y enlaces de revisión | Mantener secuencia, acciones con título y resultado esperado |
| Próximos pagos y cobros | Lista, filtros, orden y detalle de pendiente | Nombre/tipo/fecha juntos; A–Z y revisión de posibles duplicados sin borrado automático |
| Calendario | Mes y navegación | Detalle del día cercano a selección y acceso móvil claro |
| Presupuestos | Resumen, límites, opciones y editor | Separar gastado real, comprometido y margen previsto; conservar explicación junto al cálculo; no vender Pro a quien ya lo tiene |
| Objetivos | Objetivo y editores de ahorro/datos | Un editor a la vez; distinguir ahorro ya registrado y aporte previsto; nunca implicar transferencia bancaria |
| Tarjetas | Estado vacío y alta con Más detalles | Alta mínima y revisión del resumen/cierre antes de programar; pendiente probar ciclo con datos ficticios completos |
| Deudas y préstamos | Estado vacío y formulario | Diferenciar capital, saldo, cuota y tasa; revisión de extracción PDF; pendiente ciclo completo |
| Flujo | Mes a mes, composición y día a día | Resumen primero, distinguir confirmado/proyectado; ventanas legibles para horizontes largos |
| Simulador y escenarios | Controles y resultados | Etiquetas completas, campos condicionales, mostrar supuestos sin confundir escenario con datos reales |
| Resumen e informes | Período, métricas y exportaciones disponibles | Propósito diferente entre resumen simple y análisis avanzado; período consistente y filtros visibles |
| Inversiones y patrimonio | Posición existente, detalle y activos | Precio de referencia con fecha; rendimiento estimado frente a resultado realizado; compra/venta separadas de actualizar precio |
| Agro | Venta, stock y estimaciones | Subvistas claras; estimación no equivale a cobro; pasos de precio, deducciones y cobro |
| Alertas y consejos | Lista y acciones | Prioridad por urgencia e impacto, explicación y acción concreta; resto ampliable |
| Categorías | Árbol y formularios | Ejemplos y relación con presupuesto; acciones secundarias sin competir con crear |
| Importar y exportar | Pantalla y opciones, sin cargar archivos | Archivo → Revisar → Confirmar; cuenta destino, duplicados y cantidades antes de guardar |
| Favoritos y reglas | Creación y reglas | Explicar atajo frente a clasificación automática; «Si el texto contiene… → categoría» |
| Costos de servicios y traslado de margen | Formularios y condiciones | Mostrar dependencia de datos y explicar qué modifica cada opción |
| Ayuda y chat | Categorías, FAQ, Inicio e historial | Guías cortas por tarea; asistencia contextual; historial conservado, apertura en Inicio y acceso claro a equipo |
| Configuración | Nueve secciones y estados disponibles | Estructura estable indicada arriba |
| Admin | Resumen, Cobros, Comunicaciones/Seguimiento y Finanzas | Separar intentos, clientes pagos y dinero acreditado; revisar el detalle contable con proveedor antes de automatizar |

Las capturas corresponden a navegación y controles concretos. No se afirma que cada botón de guardar, eliminar, cobrar, importar o enviar haya sido ejecutado: se evitó mutar datos reales.

## Solicitudes de plan pendientes: política propuesta

### Lo que ya existe

`src/server/billing.ts` contiene bloqueo por espacio, recuperación de intentos creating/uncertain, reutilización de pendientes compatibles, comprobación del proveedor y reemplazo controlado con verificación de pagos. Los webhooks y la reconciliación son parte del flujo actual. No se propone reemplazarlos por una decisión del navegador.

`src/server/admin-metrics.ts` y `src/server/business-state.ts` separan cobertura pagada de intentos. En el resumen administrativo observado, el churn se mostraba «No aplica» sin clientes pagos y el intento pendiente se contaba aparte. No se confirmó que hoy ese intento esté inflando el churn.

### Etapas propuestas, sujetas a aprobación

1. Durante las primeras 24 horas: solicitud pendiente, continuar la misma si sigue válida. No crear otra por recargar o abrir dos pestañas.
2. Después de 24 horas sin completar: clasificación comercial «Contratación sin completar». Es una etiqueta local de seguimiento, no una baja de cliente ni una cancelación remota automática.
3. Evaluar una caducidad de 7 días como política propia, no como vencimiento garantizado por Mercado Pago. Antes de cerrar, consultar contrato y pagos autorizados/aprobados/en proceso. Si existe incertidumbre, conservar y conciliar. Solo confirmar vencimiento después de confirmar el cierre remoto cuando corresponda.
4. Separar del trial y de cualquier período ya pagado. El intento no concede cobertura paga ni quita cobertura existente.

**Recomendación inicial:** implementar primero clasificación por antigüedad y revisión segura; dejar el cierre remoto automático para una segunda aprobación. Cancelar una solicitud pendiente en Mercado Pago puede provocar un correo de cancelación del proveedor. No prometer que ese correo se puede suprimir desde Guafra.

| Situación | Acción segura | Efecto administrativo |
| --- | --- | --- |
| Pendiente válido y sin pago | Reutilizar intención | Intento pendiente, no ingreso ni churn |
| Pendiente antiguo sin evidencia de pago | Marcar sin completar; verificar antes de cerrar | Abandono de contratación |
| Pago en proceso | Esperar y conciliar | Pendiente de confirmación; no vencido por reloj |
| Remoto autorizado, local pendiente | Sincronizar | Contrato reconocido; cobertura según pago/período validado |
| Creating/uncertain sin respuesta confiable | Recuperar o escalar | Requiere revisión, no cancelación por antigüedad |
| Aprobado con navegador cerrado | Webhook/reconciliación | Pago y cobertura una sola vez |
| Cambio mensual/anual | Reemplazo explícito y serializado | Un intento vigente; preservar historial |
| Trial termina con intento pendiente | Calcular acceso separado del intento | Trial vencido no equivale a cliente pago perdido |

Agregar una pestaña **Intentos de contratación** en Cobros: ciclo, importe, antigüedad, última consulta al proveedor, estado y motivo de cierre. Filtros: pendiente, sin completar, convertido, vencido y requiere revisión. Nunca sumar el importe solicitado a ingresos cobrados, MRR ni dinero disponible.

La documentación oficial describe la gestión de suscripciones, pagos pendientes y notificaciones; los plazos 24 h/7 días de esta propuesta son decisiones de producto: [gestión](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/subscription-management), [pendientes](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments), [webhooks](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks).

## Correos existentes y propuestos

### Inventario confirmado en código

| Familia | Eventos encontrados | Evidencia |
| --- | --- | --- |
| Cuenta | Bienvenida/verificación, bienvenida con Google, recuperación y cambio de contraseña | `src/server/account-mail.ts`, acciones de autenticación y callback de Google |
| Seguridad | Nuevo dispositivo, cambios de segundo factor, uso de recuperación, incorporación al espacio | `src/server/account-mail.ts` |
| Acceso de prueba | Próximo fin dentro de 24 h y trial terminado dentro de 24 h, con comprobación de vigencia/destinatario | `src/server/access-notices.ts` |
| Suscripciones | Autorización, pausa y cancelación cuando corresponde al cambio de estado | `src/server/billing.ts` |
| Pagos | Aprobación, rechazo, reembolso/contracargo y devolución parcial | `src/server/billing.ts`, `src/server/billing-mail.ts` |
| Soporte | Recepción y código, derivación al equipo, aviso de respuesta y enlace al mismo caso | `src/server/contact.ts`, `src/server/support-replies.ts` y flujo de chat |

La renovación exitosa usa la confirmación del pago correspondiente; no hace falta duplicarla con otra campaña. Billing dispone de outbox, claves de deduplicación, reintentos y comprobación de relevancia; esto no prueba la entrega de todos los mensajes. La recepción de respuestas por correo continúa pendiente por decisión previa: el usuario responde en el chat desde el enlace del aviso.

### Marketing y recuperación: no activados

La decisión anterior era correo transaccional únicamente. Esta nueva solicitud permite proponer campañas; no se cambió esa política ni se enviaron mensajes. Antes de activarlas, se necesita consentimiento separado, preferencias, baja sencilla, registro de consentimiento y supresión de destinatarios. Resend distingue los avisos de servicio de los estímulos de onboarding promocionales y recomienda baja para estos últimos: [onboarding](https://resend.com/guides/email/plan-onboarding-email-program), [preferencias por tema](https://resend.com/blog/unsubscribe-topics).

| Recorrido propuesto | Momento orientativo | Contenido y condición de salida |
| --- | --- | --- |
| Configuración incompleta | Día 1 y, como máximo, otro aviso día 3 | Una tarea pendiente concreta y ayuda; detener al completar u omitir |
| Checkout abandonado | Un aviso tras 24 h por intención | «¿Necesitás ayuda para completar tu contratación?»; enlace seguro para consultar estado; detener ante aprobación/autorización o caso sensible abierto |
| Aprender durante trial | Día 3 o 7, solo con consentimiento | Una función útil según el uso; sin duplicar los avisos de fin existentes |
| Pago fallido | Aviso de servicio tras confirmación; recordatorio limitado si sigue fallido | Importe/estado correcto y acción segura; no crear otro cobro ni decir cancelado cuando solo está pendiente |
| Baja de renovación | Confirmación de servicio existente | Fecha de acceso restante y consecuencias reales |
| Recuperación de excliente | Encuesta opcional tras fin +7 días; una invitación de regreso a 30 días | Solo consentimiento; detener al volver; no dificultar la baja |
| Inactividad | Consejo ocasional, opcional | Utilidad concreta, sin exponer saldos ni mensajes invasivos |

Límite propuesto: máximo dos correos de marketing por semana y no dos campañas el mismo día. Excluir pruebas/internos, eliminados, suspendidos, rebotes, bajas y conflictos de pago/privacidad. No incluir finanzas personales en campañas. Validar estado antes de enviar, deduplicar por usuario+evento y permitir vista previa y modo simulación en Admin. No inferir éxito por apertura de email: medir tarea completada, contrato autorizado y pago confirmado por separado.

Preferencias sugeridas, inicialmente desactivadas: Consejos de uso, Novedades y Ofertas. Seguridad, pagos y respuestas de soporte permanecen separados como comunicaciones de servicio.

## Implementación y validación propuestas

1. **Primero, P1 de claridad y consistencia**: ingreso preseleccionado, ciclo pendiente coherente y corrección controlada de recurrencias. Estimación 1–3 días de desarrollo/QA según alcance de edición histórica. No modificar registros existentes sin revisión.
2. **Después, organización visual**: estructura común de Configuración, formularios con acciones claras, objetivos, simulador y chat contextual. Estimación 3–5 días, incluyendo revisión móvil y teclado. Mantener rutas, permisos y funciones.
3. **Seguimiento comercial seguro**: antigüedad de intentos y pestaña de administración sin cancelar remotamente. Estimación 1–2 días. Un cierre remoto automático requiere diseño, aprobación y pruebas separadas.
4. **Correos opcionales**: preferencias/consentimiento/supresiones, simulación y luego un único recorrido piloto. Estimación 3–5 días, dependiente de aprobación del modelo comercial y contenido.

Pruebas de regresión prioritarias: dirección y signo desde cada acceso; persistencia de ciclo; pendiente válido reutilizado; doble pestaña; evento aprobado después de abandono; pago en proceso nunca vencido por antigüedad; trial y período pago conservados; métricas sin falso churn; un editor por tarjeta sin perder borrador; navegación estable; teclado y foco; 320/375/768/1280 px; textos largos, importes grandes y listas vacías. Marketing: sin consentimiento no enviar, baja inmediata, no duplicados, interrupción al convertir y cero datos financieros en plantillas.

Actualizar Ayuda y respuestas del chatbot después de aprobar el comportamiento, en el mismo cambio. Términos/Privacidad solo cuando cambie una condición o tratamiento real; no reescribirlos por un cambio de espaciado. Revisión profesional de textos de consentimiento cuando corresponda.

Cada fase debe ir en rama separada con revisión y pruebas. Sin migraciones o cambios de producción implícitos. Reversión visual mediante revert y despliegue; las políticas comerciales y migraciones, si se aprueban, necesitan su propio plan de reversión compatible con usuarios y datos.
