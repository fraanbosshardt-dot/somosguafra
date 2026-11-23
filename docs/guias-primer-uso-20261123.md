# Guías de primer uso — 23/11/2026

## Diagnóstico y alcance autorizado

Las herramientas nuevas tenían una explicación desplegable, pero no un recorrido visible al entrar por primera vez. Se añade una guía en la misma pantalla, sin ventanas superpuestas, cambios de datos ni pasos obligatorios. Se conserva la ayuda contextual existente en las demás áreas.

Tres pasos para Presupuestos, Trasladar margen, Nuevo movimiento (incluye división de compras), Favoritos y reglas, Resumen mensual, Importar y Costo de mis servicios. Las guías explican el alcance real, distinguen Gratis/Pro y no habilitan herramientas restringidas. El acceso sigue validado por el servidor.

## Interacción y datos

- Se muestra una vez por versión de guía y ruta exacta en ese navegador. Las páginas de detalle y edición no activan recorridos por coincidencia de prefijo.
- Anterior, Siguiente, Omitir guía y Empezar a usar. La pantalla sigue disponible durante el recorrido. El botón Guía paso a paso permite reabrirlo desde el comienzo.
- El foco pasa al título del paso al avanzar, y vuelve al botón de apertura al cerrar. No se roba el foco al mostrarse automáticamente. Controles con mínimo de 44 px y acciones adaptables al ancho del móvil.
- Almacenamiento local: `guafra:guia:v1:<ruta> = vista`; no guarda cuentas, importes, identidad ni respuestas. Si no está disponible, el recorrido funciona y se recuerda durante la sesión de JavaScript. En otro navegador o al borrar almacenamiento puede aparecer nuevamente.
- Ayuda y chatbot comparten la explicación de reapertura y persistencia. Cookies informa esta preferencia. No se cambian contratos, precios, movimientos, presupuestos ni pagos.

## Validación

- TypeScript local aprobado.
- La comprobación visual interactiva se intentó con base ficticia aislada, sin credenciales externas. Computer Use bloqueó la captura porque no pudo determinar la URL de Brave con suficiente confianza; no se continuaron acciones sobre esa ventana ni se afirma haber verificado interacciones visuales.
- CI debe aprobar tipos, suite existente, compilación y smoke HTTP del commit exacto antes de fusionar. No hay migraciones ni dependencias nuevas.

## Comprobación manual pendiente

En 320/390 px y escritorio: abrir Presupuestos por primera vez, recorrer tres pasos con teclado, omitir, reabrir y recargar para verificar que no se expande de nuevo. Repetir con Importar sin subir archivos ni guardar operaciones. Comprobar que el foco y el contenido del formulario no se pierden. No borrar almacenamiento del navegador de una persona para simular primer uso; usar un perfil de prueba.

## Reversión

Revertir esta entrega y redesplegar. No hay cambios en base de datos que revertir. Las marcas locales son inocuas si la versión anterior no las utiliza.
